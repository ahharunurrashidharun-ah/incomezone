import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  sendTelegramAlert, 
  sendDepositAlert, 
  sendWithdrawalAlert, 
  sendJobSubmissionAlert, 
  sendJobPostedAlert, 
  sendAdPostedAlert,
  sendNewUserAlert 
} from '../utils/telegramNotifier';

/**
 * Global Realtime Database Listener for Telegram Notifications
 * Runs continuously in the background and forwards site events to Telegram Bot
 */
export default function TelegramNotificationListener() {
  useEffect(() => {
    // 1. Listen for generic email_notifications table inserts if present
    const emailNotifChannel = supabase
      .channel('telegram-email-notifs-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_notifications' },
        (payload) => {
          const newNotif = payload.new;
          if (newNotif) {
            const formatted = `🔔 <b>[IncomeZone Notice]</b>\n\n<b>${newNotif.subject || 'New Notification'}</b>\n\n${newNotif.message || ''}`;
            sendTelegramAlert(formatted, `email_notif_${newNotif.id || Date.now()}`);
          }
        }
      )
      .subscribe();

    // 2. Listen for new Deposit Requests
    const depositsChannel = supabase
      .channel('telegram-deposits-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'deposit_requests' },
        (payload) => {
          const d = payload.new;
          if (d) {
            sendDepositAlert({
              amount: Number(d.amount || 0),
              method: d.method || 'Mobile Banking',
              transactionId: d.transaction_id || d.transactionId || 'N/A',
              senderNumber: d.sender_number || d.senderNumber || 'N/A',
              userId: d.user_id,
            });
          }
        }
      )
      .subscribe();

    // 3. Listen for new Withdrawal Requests
    const withdrawalsChannel = supabase
      .channel('telegram-withdrawals-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'withdraw_requests' },
        (payload) => {
          const w = payload.new;
          if (w) {
            sendWithdrawalAlert({
              amount: Number(w.amount || 0),
              method: w.method || 'Mobile Banking',
              accountNumber: w.account_number || w.accountNumber || 'N/A',
              userId: w.user_id,
            });
          }
        }
      )
      .subscribe();

    // 4. Listen for new Job Submissions
    const submissionsChannel = supabase
      .channel('telegram-submissions-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'submissions' },
        (payload) => {
          const s = payload.new;
          if (s) {
            sendJobSubmissionAlert({
              jobId: s.job_id || s.jobId || 'N/A',
              workerId: s.worker_id || s.workerId,
              workerDisplayId: s.worker_display_id || s.workerDisplayId,
              proofText: s.proof_text || s.proofText,
            });
          }
        }
      )
      .subscribe();

    // 5. Listen for new Jobs Posted
    const jobsChannel = supabase
      .channel('telegram-jobs-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'jobs' },
        (payload) => {
          const j = payload.new;
          if (j) {
            sendJobPostedAlert({
              title: j.title || 'Untitled Job',
              category: j.category,
              pricePerTask: Number(j.price_per_task || j.pricePerTask || 0),
              totalSlots: Number(j.total_slots || j.totalSlots || 1),
            });
          }
        }
      )
      .subscribe();

    // 6. Listen for new User Registrations
    const usersChannel = supabase
      .channel('telegram-users-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'users' },
        (payload) => {
          const u = payload.new;
          if (u) {
            sendNewUserAlert({
              email: u.email || 'N/A',
              name: u.name,
              username: u.username,
              ip: u.ip_address,
              isPending: u.status === 'pending' || u.is_pending,
            });
          }
        }
      )
      .subscribe();

    // 7. Listen for new Ads Posted
    const adsChannel = supabase
      .channel('telegram-ads-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ads' },
        (payload) => {
          const a = payload.new;
          if (a) {
            sendAdPostedAlert({
              title: a.title || 'Sponsored Ad',
              targetUrl: a.target_url || a.targetUrl,
            });
          }
        }
      )
      .subscribe();

    // Cleanup channels on unmount
    return () => {
      supabase.removeChannel(emailNotifChannel);
      supabase.removeChannel(depositsChannel);
      supabase.removeChannel(withdrawalsChannel);
      supabase.removeChannel(submissionsChannel);
      supabase.removeChannel(jobsChannel);
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(adsChannel);
    };
  }, []);

  return null; // Headless background component
}
