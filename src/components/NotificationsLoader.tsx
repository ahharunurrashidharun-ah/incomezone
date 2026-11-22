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
      // 1. Process local pending emails once without infinite retry spam
      const localPending = getLocalPendingEmails().filter((item) => !item.sent);
      for (const localAlert of localPending.slice(0, BATCH_LIMIT)) {
        const localKey = `local_${localAlert.id}`;
        const localAttempts = failureCountRef.current.get(localKey) || 0;
        if (localAttempts >= 1) continue;
        try {
          const success = await sendEmailAlert(localAlert);
          if (success && localAlert.id) {
            markLocalPendingEmailSent(localAlert.id);
          } else {
            failureCountRef.current.set(localKey, localAttempts + 1);
          }
        } catch {
          failureCountRef.current.set(localKey, localAttempts + 1);
        }
      }

      // 2. Fetch unsent notifications from Supabase
      const { data: unsentNotifications, error } = await supabase
        .from('email_notifications')
        .select('*')
        .eq('sent', false)
        .order('created_at', { ascending: true })
        .limit(BATCH_LIMIT);

      if (error || !unsentNotifications || unsentNotifications.length === 0) {
        return;
      }

      // 3. Dispatch each unsent notification at most once per session if no RPC is active
      for (const notif of unsentNotifications) {
        const attempts = failureCountRef.current.get(notif.id) || 0;
        if (attempts >= 1) {
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
          if (success) {
            const { error: updateError } = await supabase
              .from('email_notifications')
              .update({ sent: true })
              .eq('id', notif.id);

            if (!updateError) {
              failureCountRef.current.delete(notif.id);
            }
          } else {
            failureCountRef.current.set(notif.id, attempts + 1);
          }
        } catch {
          failureCountRef.current.set(notif.id, attempts + 1);
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
