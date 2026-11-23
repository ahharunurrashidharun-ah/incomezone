export type AccountSupportScope = 'active' | 'pending' | 'blocked' | 'deleted';

export interface ReadymadeFaqItem {
  id: string;
  question: string;
  answer: string;
  scopes: AccountSupportScope[];
  keywords: string[];
}

export const READYMADE_FAQS: ReadymadeFaqItem[] = [
  {
    id: 'faq_deposit',
    question: 'ডিপোজিট করার নিয়ম কী ও কতক্ষণ লাগে?',
    scopes: ['active'],
    keywords: [
      'deposit',
      'ডিপোজিট',
      'রিচার্জ',
      'টাকা পাঠাবো',
      'টাকা এড',
      'টাকা যোগ',
      'add money',
      'bkash',
      'nagad',
      'rocket',
      'বিকাশ',
      'নগদ',
      'রকেট',
      'trxid',
      'ট্রানজেকশন',
      'কতক্ষণ',
      'পেন্ডিং ডিপোজিট',
    ],
    answer: `**IncomeZone-এ ডিপোজিট করার নিয়ম:**
- আপনার অ্যাকাউন্ট থেকে /deposit পেজে যান। (প্ল্যাটফর্ম রেট: **$1.00 = ৳১০০**)
- সেখানে থাকা সক্রিয় মেথড (**bKash**, **Nagad** বা **Rocket**)-এর অফিশিয়াল নম্বরে **Send Money** করুন।
- এরপর ফর্মে আপনার **Sender Number**, সঠিক **Transaction ID (TrxID)** এবং **USD পরিমাণ** লিখে সাবমিট করুন।
- অ্যাডমিন যাচাই করে অ্যাপ্রুভ করার সাথে সাথেই আপনার **Deposit Balance**-এ টাকা (এবং বোনাস চালু থাকলে বোনাস) যোগ হয়ে যাবে।`,
  },
  {
    id: 'faq_withdraw',
    question: 'টাকা উইথড্র করবো কীভাবে ও চার্জ কত?',
    scopes: ['active'],
    keywords: [
      'withdraw',
      'উইথড্র',
      'উত্তোলন',
      'টাকা তুলবো',
      'টাকা নেব',
      'পেমেন্ট',
      'payment',
      'cashout',
      'ক্যাশআউট',
      'চার্জ',
      'fee',
      'মোবাইল রিচার্জ',
      'recharge',
      'আর্নিং',
      'earning',
    ],
    answer: `**টাকা উত্তোলন (Withdraw) করার নিয়ম:**
- শুধুমাত্র কাজ করে অর্জিত **Earning Balance** থেকে /withdraw পেজের মাধ্যমে টাকা তোলা যায় (রেট: **$1.00 = ৳১০০**)।
- **bKash**, **Nagad**, **Rocket** অথবা **Mobile Recharge** মেথড সিলেক্ট করে আপনার নম্বর ও পরিমাণ দিয়ে রিকোয়েস্ট পাঠান।
- লাইভ **Withdraw Fee %** বা **Bonus %** /withdraw পেজেই দেখা যায়।
- অ্যাডমিন যাচাই করে পেমেন্ট পাঠিয়ে দেন; কোনো কারণে রিকোয়েস্ট রিজেক্ট হলে টাকা স্বয়ংক্রিয়ভাবে আপনার Earning Balance-এ ফেরত আসে।`,
  },
  {
    id: 'faq_wallets',
    question: 'ডিপোজিট ব্যালেন্স ও আর্নিং ব্যালেন্সের পার্থক্য কী?',
    scopes: ['active'],
    keywords: [
      'পার্থক্য',
      'difference',
      'দুই ব্যালেন্স',
      'ওয়ালেট',
      'wallet',
      'deposit balance',
      'earning balance',
      'ট্রান্সফার',
      'transfer',
      'তুলতে পারি না',
    ],
    answer: `**দুইটি ব্যালেন্সের কাজ সম্পূর্ণ আলাদা:**
- **Deposit Balance (ডিপোজিট ব্যালেন্স):** এটি শুধুমাত্র নতুন জব পোস্ট (/post-job) এবং স্পন্সরড বিজ্ঞাপন (/post-ad) দেওয়ার জন্য ব্যবহার হয়। এটি সরাসরি উইথড্র করা যায় না।
- **Earning Balance (আর্নিং ব্যালেন্স):** /jobs থেকে কাজ সম্পন্ন করে এই ব্যালেন্স আয় হয় এবং শুধুমাত্র এই ব্যালেন্সই /withdraw পেজ থেকে উত্তোলন করা যায়।`,
  },
  {
    id: 'faq_job_proof',
    question: 'জব করে প্রুফ সাবমিট করার সঠিক নিয়ম কী?',
    scopes: ['active'],
    keywords: [
      'job',
      'জব',
      'কাজ',
      'proof',
      'প্রুফ',
      'সাবমিট',
      'submit',
      'screenshot',
      'স্ক্রিনশট',
      'ছবি',
      'প্রমাণ',
      'দেখতে পাই না',
      'submitted',
      'রিজেক্ট',
      'reject',
    ],
    answer: `**জব সম্পন্ন ও প্রুফ সাবমিটের নিয়ম:**
- /jobs পেজ থেকে যেকোনো একটি অ্যাক্টিভ জব খুলে শর্তাবলি ভালোভাবে পড়ুন এবং কাজটি সঠিকভাবে সম্পন্ন করুন।
- এরপর সঠিক টেক্সট প্রুফ ও আসল স্ক্রিনশট দিয়ে সাবমিট করুন। প্রতিটি জবে **একবারই** প্রুফ দেওয়া যায়।
- **গুরুত্বপূর্ণ:** ভুয়া বা ডুপ্লিকেট স্ক্রিনশট দিলে কাজ রিজেক্ট হবে এবং একাউন্ট ব্লক হতে পারে।
- **প্রাইভেসি নীতি:** সাবমিট করা কাজ অ্যাপ্রুভ বা রিজেক্ট হওয়ার পর প্রুফের ছবি স্থায়ীভাবে ডাটাবেস থেকে ডিলিট হয়ে যায়—তাই /submitted-jobs-এ পুরনো ছবি দেখা যায় না।`,
  },
  {
    id: 'faq_post_job',
    question: 'নতুন জব বা বিজ্ঞাপন পোস্ট করবো কীভাবে?',
    scopes: ['active'],
    keywords: [
      'post job',
      'post ad',
      'জব পোস্ট',
      'অ্যাড পোস্ট',
      'বিজ্ঞাপন',
      'কাজ দিবো',
      'my job',
      'মাই জব',
      'sponsored',
      'প্যাকেজ',
      'দাম',
      'cost',
      'কত খরচ',
    ],
    answer: `**জব ও বিজ্ঞাপন পোস্ট করার নিয়ম:**
- **জব পোস্ট (/post-job):** আপনার **Deposit Balance** থেকে প্রতি কাজের রেট × মোট স্লট অনুযায়ী খরচ কেটে নেওয়া হবে। অ্যাডমিন অ্যাপ্রুভ করলে কাজটি লাইভ হবে এবং আপনি /my-jobs থেকে ওয়ার্কারদের প্রুফ অ্যাপ্রুভ বা রিজেক্ট করতে পারবেন।
- **বিজ্ঞাপন পোস্ট (/post-ad):** Deposit Balance দিয়ে ১ দিন ($1), ৩ দিন ($2), ৫ দিন ($3), ৭ দিন ($4), ১০ দিন ($5), ২০ দিন ($8), ৩০ দিন ($10) বা ১ বছর ($100) মেয়াদি অ্যাড দিতে পারবেন। অ্যাডমিন অ্যাপ্রুভ করার পর অ্যাডটি চালু হবে।
- কোনো জব বা অ্যাড অ্যাডমিন রিজেক্ট করলে অব্যবহৃত টাকা Deposit Balance-এ ফেরত দেওয়া হয়।`,
  },
  {
    id: 'faq_notifications',
    question: 'ফোনের নোটিফিকেশন চালু হচ্ছে না কেন?',
    scopes: ['active'],
    keywords: [
      'notification',
      'নোটিফিকেশন',
      'পুশ',
      'push',
      'ফোনে আসে না',
      'মেসেজ আসে না',
      'alert',
      'অ্যালার্ট',
      'chrome',
      'ক্রোম',
    ],
    answer: `**ফোনে পুশ নোটিফিকেশন চালু করার উপায়:**
- আপনার ফোনের **Google Chrome** ব্রাউজার দিয়ে সরাসরি ওয়েবসাইটটি ওপেন করুন।
- /notifications পেজে গিয়ে **নোটিফিকেশন চালু করুন** বাটনে ট্যাপ করে ব্রাউজারের **Allow** পারমিশন দিন।
- এরপর **"টেস্ট নোটিফিকেশন পাঠান"** বাটনে ট্যাপ করে যাচাই করুন যে ফোনের নোটিফিকেশন বারে মেসেজ আসছে।
- তবুও না এলে ফোনের Settings > Apps > Chrome > Notifications অন করা আছে কিনা দেখুন।`,
  },
  {
    id: 'faq_profile',
    question: 'নাম বা পাসওয়ার্ড পরিবর্তন করবো কীভাবে?',
    scopes: ['active'],
    keywords: [
      'profile',
      'প্রোফাইল',
      'নাম',
      'পাসওয়ার্ড',
      'password',
      'পরিবর্তন',
      'change',
      'এডিট',
      'edit',
    ],
    answer: `**প্রোফাইল ও পাসওয়ার্ড পরিবর্তন:**
- ড্যাশবোর্ডের উপরের ডানদিকে আপনার প্রোফাইল আইকন থেকে /profile পেজে যান।
- সেখান থেকে আপনার **নাম** অথবা **পাসওয়ার্ড** নিরাপদভাবে পরিবর্তন করতে পারবেন।`,
  },
  {
    id: 'faq_pending_why',
    question: 'আমার একাউন্ট আইপি পেন্ডিং দেখাচ্ছে কেন?',
    scopes: ['pending'],
    keywords: [
      'pending',
      'পেন্ডিং',
      'আইপি',
      'ip',
      'কেন',
      'একই আইপি',
      'একাধিক একাউন্ট',
      'multi account',
    ],
    answer: `**অ্যাকাউন্ট IP পেন্ডিং হওয়ার কারণ:**
- একটি ডিভাইস বা একই ইন্টারনেট/IP অ্যাড্রেস থেকে একাধিক একাউন্ট খোলার চেষ্টা করলে প্ল্যাটফর্মের নিরাপত্তার স্বার্থে নতুন একাউন্টটি স্বয়ংক্রিয়ভাবে **IP Pending** অবস্থায় রাখা হয়।
- অ্যাডমিন ম্যানুয়ালি যাচাই করে অ্যাপ্রুভ করার আগ পর্যন্ত এই একাউন্ট থেকে লগইন বা কাজ করা যায় না।`,
  },
  {
    id: 'faq_pending_approve',
    question: 'পেন্ডিং একাউন্ট কবে ও কীভাবে অ্যাপ্রুভ হবে?',
    scopes: ['pending'],
    keywords: [
      'কবে',
      'কীভাবে',
      'অ্যাপ্রুভ',
      'approve',
      'সক্রিয়',
      'active',
      'check status',
      'যাচাই',
      'সময়',
    ],
    answer: `**পেন্ডিং একাউন্ট সক্রিয় করার উপায়:**
- পপআপে থাকা **"অ্যাপ্রুভ হয়েছে কিনা যাচাই করুন (Check Status)"** বাটনে ক্লিক করে দেখতে পারেন অ্যাডমিন একাউন্টটি সক্রিয় করেছেন কিনা।
- দ্রুত রিভিউ বা অনুমোদনের জন্য আপনার একাউন্টের **ইমেইল ও IP ঠিকানা** উল্লেখ করে **incomezone2729@gmail.com** ঠিকানায় ইমেইল পাঠান।`,
  },
  {
    id: 'faq_blocked_why',
    question: 'আমার একাউন্ট কেন ব্লক করা হয়েছে?',
    scopes: ['blocked'],
    keywords: [
      'block',
      'blocked',
      'ব্লক',
      'লক',
      'locked',
      'কেন',
      'কারণ',
      'reason',
      'ব্যালেন্স',
    ],
    answer: `**অ্যাকাউন্ট ব্লক হওয়ার সম্ভাব্য কারণ:**
- একই ব্যক্তি একাধিক একাউন্ট ব্যবহার করলে।
- জবে ভুয়া, এডিট করা বা ডুপ্লিকেট প্রুফ/স্ক্রিনশট সাবমিট করলে।
- কমিউনিটি নীতিমালা (/rules) ভঙ্গ করলে অ্যাডমিন নিরাপত্তার স্বার্থে একাউন্ট ব্লক করেন।`,
  },
  {
    id: 'faq_blocked_appeal',
    question: 'একাউন্ট আনব্লক করার জন্য কীভাবে আপিল করবো?',
    scopes: ['blocked'],
    keywords: [
      'আনব্লক',
      'unblock',
      'আপিল',
      'appeal',
      'খুলবো',
      'ঠিক করবো',
      'সমাধান',
      'ব্যালেন্সের কি হবে',
    ],
    answer: `**ব্লক হওয়া একাউন্ট রিভিউ করার উপায়:**
- আপনার রেজিস্টার্ড **ইমেইল**, **Account ID** এবং বিস্তারিত ব্যাখ্যাসহ সরাসরি **incomezone2729@gmail.com**-এ ইমেইল পাঠান।
- অ্যাডমিন আপনার একাউন্ট ও কাজের ইতিহাস যাচাই করে উপযুক্ত হলে আনব্লকের সিদ্ধান্ত জানাবেন। ব্লক থাকা অবস্থায় ব্যালেন্স বা উইথড্র সুবিধা স্থগিত থাকে।`,
  },
  {
    id: 'faq_deleted_why',
    question: 'আমার একাউন্ট ডিলিট হয়েছে কেন এবং আবার খুলতে পারবো কি?',
    scopes: ['deleted'],
    keywords: [
      'delete',
      'deleted',
      'ডিলিট',
      'কেন',
      'নতুন একাউন্ট',
      'আবার',
      'create',
      'খুলতে পারবো',
      'ইমেইল',
    ],
    answer: `**ডিলিট হওয়া একাউন্ট সংক্রান্ত তথ্য:**
- দীর্ঘ নিষ্ক্রিয়তা বা নীতিমালা/অ্যাডমিন যাচাইয়ের ভিত্তিতে একাউন্টটি ডিলিট করা হয়ে থাকতে পারে।
- আপনি চাইলে এই একই ইমেইল ব্যবহার করে পপআপের **"নতুন একাউন্ট খুলুন (Create Account)"** বাটনে ক্লিক করে নতুন করে একাউন্ট খুলতে পারবেন।
- পূর্বের একাউন্ট বিষয়ে জানতে চাইলে **incomezone2729@gmail.com**-এ যোগাযোগ করুন।`,
  },
  {
    id: 'faq_admin_contact',
    question: 'অ্যাডমিনের সাথে সরাসরি যোগাযোগ করবো কীভাবে?',
    scopes: ['active', 'pending', 'blocked', 'deleted'],
    keywords: [
      'admin',
      'অ্যাডমিন',
      'যোগাযোগ',
      'contact',
      'email',
      'ইমেইল',
      'সাপোর্ট',
      'support',
      'হেল্প',
      'help',
      'নম্বর',
      'ফোন',
    ],
    answer: `**অ্যাডমিনের সাথে যোগাযোগের মাধ্যম:**
- অফিশিয়াল সাপোর্ট ইমেইল: **incomezone2729@gmail.com**
- ইমেইল পাঠানোর সময় আপনার **রেজিস্টার্ড ইমেইল**, **Account Display ID** এবং কোনো পেমেন্ট সংক্রান্ত বিষয় হলে **Transaction ID (TrxID)** অবশ্যই উল্লেখ করুন।`,
  },
];

export function getQuickFaqsForScope(scope: AccountSupportScope): ReadymadeFaqItem[] {
  const scoped = READYMADE_FAQS.filter((item) => item.scopes.includes(scope));
  return scoped.length > 0 ? scoped : READYMADE_FAQS.filter((item) => item.scopes.includes('active'));
}

const GREETING_WORDS = [
  'সালাম',
  'আসসালামু',
  'হ্যালো',
  'হাই',
  'hello',
  'hi',
  'hey',
  'assalamu',
  'salam',
  'কেমন আছেন',
  'ভালো আছেন',
];

const THANKS_WORDS = ['ধন্যবাদ', 'থ্যাংকস', 'thanks', 'thank you', 'shukriya', 'শুকরিয়া', 'ok', 'আচ্ছা', 'ঠিক আছে'];

export function matchReadymadeSupportReply(
  userText: string,
  scope: AccountSupportScope
): { reply: string; matchedFaqId?: string } {
  const raw = userText.trim();
  const lower = raw.toLowerCase();

  // 1. Exact question match first
  const exactMatch = READYMADE_FAQS.find(
    (item) => item.question.toLowerCase() === lower
  );
  if (exactMatch) {
    return { reply: exactMatch.answer, matchedFaqId: exactMatch.id };
  }

  // 2. Score all FAQs based on keyword matches + word overlap
  const cleanTokens = lower
    .replace(/[?.,!।/\\()[\]{}"':;-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  let bestItem: ReadymadeFaqItem | null = null;
  let bestScore = 0;

  for (const item of READYMADE_FAQS) {
    let score = 0;

    for (const kw of item.keywords) {
      const kwLower = kw.toLowerCase();
      if (lower.includes(kwLower)) {
        score += kwLower.length >= 5 ? 6 : 4;
      }
    }

    const qLower = item.question.toLowerCase();
    for (const token of cleanTokens) {
      if (qLower.includes(token)) {
        score += 2;
      }
    }

    // Prioritize items matching the user's current account scope
    if (score > 0 && item.scopes.includes(scope)) {
      score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  if (bestItem && bestScore >= 4) {
    return { reply: bestItem.answer, matchedFaqId: bestItem.id };
  }

  // 3. Check greeting / thanks
  if (GREETING_WORDS.some((w) => lower.includes(w))) {
    const scopeHint =
      scope === 'pending'
        ? 'আপনার পেন্ডিং একাউন্ট বিষয়ে'
        : scope === 'blocked'
        ? 'আপনার ব্লক একাউন্ট বিষয়ে'
        : scope === 'deleted'
        ? 'আপনার ডিলিট হওয়া একাউন্ট বিষয়ে'
        : 'ডিপোজিট, উইথড্র, জব সাবমিশন, অ্যাড বা নোটিফিকেশন বিষয়ে';
    return {
      reply: `ওয়ালাইকুমুস সালাম! IncomeZone লাইভ সাপোর্টে স্বাগতম। ${scopeHint} নিচের কমন প্রশ্নগুলো থেকে একটি সিলেক্ট করুন অথবা আপনার প্রশ্ন লিখুন—আমি সাথে সাথেই উত্তর দিচ্ছি।`,
    };
  }

  if (THANKS_WORDS.some((w) => lower === w || lower.includes(w))) {
    return {
      reply: `আপনাকেও ধন্যবাদ! আরও কোনো প্রশ্ন থাকলে নির্দ্বিধায় জিজ্ঞেস করুন অথবা প্রয়োজনে **incomezone2729@gmail.com**-এ যোগাযোগ করুন।`,
    };
  }

  // 4. Helpful fallback listing relevant common questions
  const suggestions = getQuickFaqsForScope(scope)
    .slice(0, 5)
    .map((f) => `- **${f.question}**`)
    .join('\n');

  return {
    reply: `আপনার প্রশ্নটি আমাদের কমন প্রশ্নের তালিকায় সরাসরি পাওয়া যায়নি। নিচের কমন প্রশ্নগুলো থেকে প্রয়োজনীয় বিষয়টি সিলেক্ট করতে পারেন:\n\n${suggestions}\n\nআরও নির্দিষ্ট কোনো সমস্যা বা অ্যাকাউন্ট রিভিউয়ের জন্য অনুগ্রহ করে **incomezone2729@gmail.com** ঠিকানায় ইমেইল করুন।`,
  };
}
