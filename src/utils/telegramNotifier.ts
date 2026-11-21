/**
 * IncomeZone Telegram Bot Notification Service
 * Sends instant alerts for platform events (Registrations, Submissions, Deposits, Withdrawals, Jobs, Ads)
 */

export const TELEGRAM_BOT_TOKEN = "9045862502:AAEruC-tbiCmxA3d_peL_egqdAiUq2xF2FM";
export const TELEGRAM_CHAT_ID = 8968701306;

// Anti-spam deduplication cache: prevents duplicate messages within 15 seconds
const recentAlertHashes = new Map<string, number>();

function isDuplicateAlert(key: string): boolean {
  const now = Date.now();
  const lastTime = recentAlertHashes.get(key);
  if (lastTime && now - lastTime < 15000) {
    return true;
  }
  recentAlertHashes.set(key, now);
  
  // Clean up cache periodically
  if (recentAlertHashes.size > 200) {
    for (const [k, time] of recentAlertHashes.entries()) {
      if (now - time > 60000) recentAlertHashes.delete(k);
    }
  }
  return false;
}

/**
 * Sends a raw formatted HTML message to the specified Telegram Chat
 */
export const sendTelegramAlert = async (text: string, dedupeKey?: string): Promise<boolean> => {
  if (dedupeKey && isDuplicateAlert(dedupeKey)) {
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      console.warn("Telegram API response error:", errData);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send Telegram alert:", error);
    return false;
  }
};

/**
 * Helper: Alert on New User Registration
 */
export const sendNewUserAlert = async (data: {
  email: string;
  name?: string;
  username?: string;
  id?: string;
  ip?: string;
  isPending?: boolean;
}) => {
  const statusBadge = data.isPending ? "⚠️ <b>PENDING (Security / Same IP)</b>" : "✅ <b>ACTIVE</b>";
  const message = [
    `🚨 <b>[IncomeZone] New User Registration</b>`,
    ``,
    `👤 <b>Name:</b> ${data.name || 'N/A'}`,
    `🏷️ <b>Username:</b> @${data.username || 'user'}`,
    `📧 <b>Email:</b> <code>${data.email}</code>`,
    `🌐 <b>IP Address:</b> <code>${data.ip || 'Unknown'}</code>`,
    `🚦 <b>Status:</b> ${statusBadge}`,
    `⏰ <b>Time:</b> ${new Date().toLocaleString('en-GB')}`,
  ].join('\n');

  return sendTelegramAlert(message, `signup_${data.email}_${data.ip || ''}`);
};

/**
 * Helper: Alert on Job Submission
 */
export const sendJobSubmissionAlert = async (data: {
  jobId: string;
  jobTitle?: string;
  workerEmail?: string;
  workerDisplayId?: string | number;
  workerId?: string;
  proofText?: string;
}) => {
  const message = [
    `📄 <b>[IncomeZone] New Job Submission</b>`,
    ``,
    `💼 <b>Job ID:</b> #<code>${data.jobId}</code>`,
    data.jobTitle ? `📌 <b>Job Title:</b> ${data.jobTitle}` : null,
    data.workerDisplayId ? `👷 <b>Worker ID:</b> #${data.workerDisplayId}` : null,
    data.workerEmail ? `📧 <b>Worker Email:</b> ${data.workerEmail}` : null,
    data.proofText ? `📝 <b>Proof Note:</b> <i>${data.proofText.slice(0, 150)}</i>` : null,
    `⏰ <b>Time:</b> ${new Date().toLocaleString('en-GB')}`,
  ].filter(Boolean).join('\n');

  return sendTelegramAlert(message, `sub_${data.jobId}_${data.workerId || data.workerEmail || Date.now()}`);
};

/**
 * Helper: Alert on Deposit Request
 */
export const sendDepositAlert = async (data: {
  amount: number;
  method: string;
  transactionId: string;
  senderNumber: string;
  userEmail?: string;
  userId?: string;
}) => {
  const bdtAmount = Math.round(Number(data.amount || 0) * 100);
  const message = [
    `💰 <b>[IncomeZone] New Deposit Request</b>`,
    ``,
    `💵 <b>Amount:</b> $${Number(data.amount).toFixed(2)} (৳${bdtAmount} BDT)`,
    `💳 <b>Payment Method:</b> ${data.method}`,
    `📱 <b>Sender Number:</b> <code>${data.senderNumber}</code>`,
    `🧾 <b>Trx ID:</b> <code>${data.transactionId}</code>`,
    data.userEmail ? `👤 <b>User Email:</b> ${data.userEmail}` : null,
    `⏰ <b>Time:</b> ${new Date().toLocaleString('en-GB')}`,
  ].filter(Boolean).join('\n');

  return sendTelegramAlert(message, `dep_${data.transactionId}`);
};

/**
 * Helper: Alert on Withdrawal Request
 */
export const sendWithdrawalAlert = async (data: {
  amount: number;
  method: string;
  accountNumber: string;
  userEmail?: string;
  userId?: string;
}) => {
  const bdtAmount = Math.round(Number(data.amount || 0) * 100);
  const message = [
    `💸 <b>[IncomeZone] New Withdrawal Request</b>`,
    ``,
    `💵 <b>Amount:</b> $${Number(data.amount).toFixed(2)} (৳${bdtAmount} BDT)`,
    `💳 <b>Method:</b> ${data.method}`,
    `📱 <b>Account Number:</b> <code>${data.accountNumber}</code>`,
    data.userEmail ? `👤 <b>User Email:</b> ${data.userEmail}` : null,
    `⏰ <b>Time:</b> ${new Date().toLocaleString('en-GB')}`,
  ].filter(Boolean).join('\n');

  return sendTelegramAlert(message, `with_${data.userId || ''}_${data.accountNumber}_${data.amount}`);
};

/**
 * Helper: Alert on New Job Posted
 */
export const sendJobPostedAlert = async (data: {
  title: string;
  category?: string;
  pricePerTask?: number;
  totalSlots?: number;
  employerEmail?: string;
}) => {
  const totalCost = ((data.pricePerTask || 0) * (data.totalSlots || 0)).toFixed(2);
  const message = [
    `💼 <b>[IncomeZone] New Job Posted</b>`,
    ``,
    `📌 <b>Title:</b> ${data.title}`,
    data.category ? `🏷️ <b>Category:</b> ${data.category}` : null,
    `👥 <b>Workers Needed:</b> ${data.totalSlots || 1} slots`,
    `💵 <b>Rate/Task:</b> $${Number(data.pricePerTask || 0).toFixed(2)}`,
    `💰 <b>Total Budget:</b> $${totalCost}`,
    data.employerEmail ? `👤 <b>Employer:</b> ${data.employerEmail}` : null,
    `⏰ <b>Time:</b> ${new Date().toLocaleString('en-GB')}`,
  ].filter(Boolean).join('\n');

  return sendTelegramAlert(message, `job_${data.title}_${Date.now().toString().slice(0, -4)}`);
};

/**
 * Helper: Alert on New Ad Posted
 */
export const sendAdPostedAlert = async (data: {
  title: string;
  targetUrl?: string;
  durationDays?: number;
  pricePaid?: number;
  userEmail?: string;
}) => {
  const message = [
    `📢 <b>[IncomeZone] New Ad Banner Posted</b>`,
    ``,
    `📌 <b>Ad Title:</b> ${data.title}`,
    data.targetUrl ? `🔗 <b>Target URL:</b> ${data.targetUrl}` : null,
    data.durationDays ? `⏱️ <b>Duration:</b> ${data.durationDays} Days` : null,
    data.pricePaid ? `💵 <b>Price Paid:</b> $${Number(data.pricePaid).toFixed(2)}` : null,
    data.userEmail ? `👤 <b>Advertiser:</b> ${data.userEmail}` : null,
    `⏰ <b>Time:</b> ${new Date().toLocaleString('en-GB')}`,
  ].filter(Boolean).join('\n');

  return sendTelegramAlert(message, `ad_${data.title}_${Date.now().toString().slice(0, -4)}`);
};
