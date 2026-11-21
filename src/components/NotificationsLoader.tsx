import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  sendEmailAlert, 
  getLocalPendingEmails, 
  markLocalPendingEmailSent,
  EmailAlertPayload 
} from '../lib/notificationSender';

const POLL_INTERVAL_MS = 15000; // 15 seconds poll interval
const BATCH_LIMIT = 5;

/**
 * Background NotificationsLoader component
 * Listens for new unsent records in 'email_notifications' and dispatches alerts to incomezone2729@gmail.com
 */
export default function NotificationsLoader() {
  const isProcessingRef = useRef<boolean>(false);
  const failureCountRef = useRef<Map<string | number, number>>(new Map());

  const processUnsentNotifications = async () => {
    // Guard against concurrent executions
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      // 1. Process local pending emails first if any are unsent
      const localPending = getLocalPendingEmails().filter((item) => !item.sent);
      for (const localAlert of localPending.slice(0, BATCH_LIMIT)) {
        try {
          const success = await sendEmailAlert(localAlert);
          if (success && localAlert.id) {
            markLocalPendingEmailSent(localAlert.id);
          }
        } catch (err) {
          console.warn('Local pending email dispatch attempt note:', err);
        }
      }

      // 2. Fetch unsent notifications from Supabase
      const { data: unsentNotifications, error } = await supabase
        .from('email_notifications')
        .select('*')
        .eq('sent', false)
        .order('created_at', { ascending: true })
        .limit(BATCH_LIMIT);

      if (error) {
        return;
      }

      if (!unsentNotifications || unsentNotifications.length === 0) {
        return;
      }

      // 3. Loop through each unsent notification and dispatch email
      for (const notif of unsentNotifications) {
        const attempts = failureCountRef.current.get(notif.id) || 0;
        if (attempts >= 5) {
          continue;
        }

        try {
          const payload: EmailAlertPayload = {
            id: notif.id,
            subject: notif.subject,
            message: notif.message,
            type: notif.type,
          };

          const success = await sendEmailAlert(payload);

          // Mark notification as sent in Supabase database to prevent resending
          if (success) {
            const { error: updateError } = await supabase
              .from('email_notifications')
              .update({ sent: true })
              .eq('id', notif.id);

            if (!updateError) {
              failureCountRef.current.delete(notif.id);
            }
          }
        } catch (err) {
          failureCountRef.current.set(notif.id, attempts + 1);
          console.error('Failed to send email alert:', err);
        }
      }
    } catch (globalErr) {
      console.error('Error in email notifications processing loop:', globalErr);
    } finally {
      isProcessingRef.current = false;
    }
  };

  useEffect(() => {
    // 1. Initial check on mount
    processUnsentNotifications();

    // 2. Real-time subscription to email_notifications table
    const channel = supabase
      .channel('email-notifications-watcher')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_notifications' },
        () => {
          processUnsentNotifications();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'email_notifications' },
        (payload: any) => {
          if (payload.new && payload.new.sent === false) {
            processUnsentNotifications();
          }
        }
      )
      .subscribe();

    // 3. Listen to local queue event
    const handleLocalQueued = () => {
      processUnsentNotifications();
    };
    window.addEventListener('iz_email_notification_queued', handleLocalQueued);

    // 4. Periodic polling interval (every 15s)
    const intervalId = setInterval(() => {
      processUnsentNotifications();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('iz_email_notification_queued', handleLocalQueued);
      supabase.removeChannel(channel);
    };
  }, []);

  // Purely background component - renders nothing to the DOM
  return null;
}
