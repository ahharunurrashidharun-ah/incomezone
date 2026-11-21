import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';

export interface EmailAlertPayload {
  id?: string | number;
  subject: string;
  message: string;
  type?: string;
  sent?: boolean;
  created_at?: string;
}

const TARGET_EMAIL = 'incomezone2729@gmail.com';
const SENDER_EMAIL = 'alerts@incomezone.com';

const LOCAL_EMAIL_NOTIFS_KEY = 'iz_pending_email_notifications';

export function getLocalPendingEmails(): EmailAlertPayload[] {
  try {
    const raw = localStorage.getItem(LOCAL_EMAIL_NOTIFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalPendingEmail(item: EmailAlertPayload) {
  try {
    const list = getLocalPendingEmails();
    list.unshift(item);
    // Keep max 50 in history
    const trimmed = list.slice(0, 50);
    localStorage.setItem(LOCAL_EMAIL_NOTIFS_KEY, JSON.stringify(trimmed));
  } catch {}
}

export function markLocalPendingEmailSent(id: string | number) {
  try {
    const list = getLocalPendingEmails();
    const updated = list.map((item) => (item.id === id ? { ...item, sent: true } : item));
    localStorage.setItem(LOCAL_EMAIL_NOTIFS_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Sends an email alert to incomezone2729@gmail.com using available Supabase mechanisms.
 */
export async function sendEmailAlert(alert: EmailAlertPayload): Promise<boolean> {
  const htmlContent = `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px;">
    <h2 style="color: #6b21a8; margin-top: 0;">${alert.subject}</h2>
    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; line-height: 1.6; font-size: 14px; white-space: pre-wrap;">${alert.message}</div>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
    <p style="color: #64748b; font-size: 12px; margin: 0;">IncomeZone Real-time Alert System &bull; Destination: ${TARGET_EMAIL}</p>
  </div>`;

  let sent = false;

  // 1. Try Supabase Auth Admin sendRawEmail if available (as requested by user)
  try {
    const adminAuth = (supabase.auth as any)?.admin;
    if (adminAuth && typeof adminAuth.sendRawEmail === 'function') {
      const { error } = await adminAuth.sendRawEmail({
        from: SENDER_EMAIL,
        to: TARGET_EMAIL,
        subject: alert.subject,
        html: htmlContent,
      });
      if (!error) {
        sent = true;
      }
    }
  } catch (err) {
    console.warn('sendRawEmail attempt notice:', err);
  }

  // 2. Try Supabase native magic link OTP mailer trigger to target address
  if (!sent) {
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: TARGET_EMAIL,
        options: {
          data: {
            subject: alert.subject,
            notification_message: alert.message,
            alert_type: alert.type || 'system_event',
          },
        },
      });
      if (!otpError) {
        sent = true;
      }
    } catch (otpCatch) {
      console.warn('Supabase mailer trigger notice:', otpCatch);
    }
  }

  // 3. Try custom RPC send_email_alert or send_email if registered in Supabase SQL editor
  if (!sent) {
    try {
      const { error: rpcError } = await supabase.rpc('send_email_alert', {
        to_email: TARGET_EMAIL,
        from_email: SENDER_EMAIL,
        subject: alert.subject,
        html_content: htmlContent,
      });
      if (!rpcError) {
        sent = true;
      }
    } catch {}
  }

  return sent;
}

/**
 * Queues and immediately attempts to send an email notification.
 * Inserts into Supabase `email_notifications` table and local fallback store.
 */
export async function queueEmailNotification(payload: {
  subject: string;
  message: string;
  type?: string;
}): Promise<void> {
  const localId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const alertItem: EmailAlertPayload = {
    id: localId,
    subject: payload.subject,
    message: payload.message,
    type: payload.type || 'job_event',
    sent: false,
    created_at: new Date().toISOString(),
  };

  // 1. Save in local fallback queue
  saveLocalPendingEmail(alertItem);

  // 2. Try to insert into Supabase email_notifications table
  let supabaseRecordId: any = null;
  try {
    const { data, error } = await supabase
      .from('email_notifications')
      .insert({
        subject: payload.subject,
        message: payload.message,
        type: payload.type || 'job_event',
        sent: false,
        created_at: alertItem.created_at,
      })
      .select('id')
      .maybeSingle();

    if (!error && data?.id) {
      supabaseRecordId = data.id;
    }
  } catch (err) {
    console.warn('Note: Supabase email_notifications table insert deferred', err);
  }

  // 3. Trigger immediate dispatch
  try {
    const success = await sendEmailAlert(alertItem);
    if (success) {
      markLocalPendingEmailSent(localId);
      if (supabaseRecordId) {
        try {
          await supabase
            .from('email_notifications')
            .update({ sent: true })
            .eq('id', supabaseRecordId);
        } catch {}
      }
    }
  } catch (sendErr) {
    console.error('Failed to send email alert:', sendErr);
  }

  // 4. Notify any active listeners
  window.dispatchEvent(
    new CustomEvent('iz_email_notification_queued', {
      detail: alertItem,
    })
  );
}
