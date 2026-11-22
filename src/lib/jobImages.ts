import { getLocalJobs } from './localFallbackStore';

/**
 * Generates an SVG Data URI for category fallback thumbnails
 * High performance, zero network delay, crisp vector graphics.
 */
function createSvgBanner(bg1: string, bg2: string, iconLabel: string, subText: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="250" rx="20" fill="url(#grad)"/>
    <circle cx="200" cy="95" r="44" fill="rgba(255,255,255,0.18)"/>
    <text x="200" y="108" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">${iconLabel}</text>
    <text x="200" y="172" font-family="system-ui, -apple-system, sans-serif" font-size="17" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${subText}</text>
    <text x="200" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="rgba(255,255,255,0.85)" text-anchor="middle">IncomeZone Mission</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Returns a sleek category-specific thumbnail banner
 */
export function getCategoryFallbackImage(category?: string): string {
  const cat = (category || '').toLowerCase().trim();

  if (cat.includes('youtube')) {
    return createSvgBanner('#E50914', '#850000', '▶', 'YouTube Task');
  }
  if (cat.includes('facebook')) {
    return createSvgBanner('#1877F2', '#0A3B85', 'f', 'Facebook Task');
  }
  if (cat.includes('telegram')) {
    return createSvgBanner('#229ED9', '#085D87', '✈', 'Telegram Mission');
  }
  if (cat.includes('tiktok')) {
    return createSvgBanner('#111111', '#25F4EE', '♫', 'TikTok Task');
  }
  if (cat.includes('twitter')) {
    return createSvgBanner('#1DA1F2', '#0D5B8A', '𝕏', 'Twitter Task');
  }
  if (cat.includes('instagram')) {
    return createSvgBanner('#833AB4', '#FD1D1D', '📸', 'Instagram Task');
  }
  if (cat.includes('sign up')) {
    return createSvgBanner('#059669', '#064E3B', '✓', 'Sign Up Mission');
  }
  if (cat.includes('mobile application') || cat.includes('app')) {
    return createSvgBanner('#4F46E5', '#312E81', '📱', 'App Download/Install');
  }
  if (cat.includes('survey')) {
    return createSvgBanner('#D97706', '#78350F', '📝', 'Survey & Poll');
  }
  if (cat.includes('data entry')) {
    return createSvgBanner('#0D9488', '#134E4A', '⌨', 'Data Entry Mission');
  }
  if (cat.includes('whats-app') || cat.includes('whatsapp')) {
    return createSvgBanner('#25D366', '#0F5132', '💬', 'WhatsApp Task');
  }
  if (cat.includes('reddit')) {
    return createSvgBanner('#FF4500', '#7E22CE', '🤖', 'Reddit Mission');
  }
  if (cat.includes('discord')) {
    return createSvgBanner('#5865F2', '#2B3280', '🎮', 'Discord Mission');
  }
  if (cat.includes('toffee')) {
    return createSvgBanner('#7C3AED', '#4C1D95', '🎬', 'Toffee Video Task');
  }
  if (cat.includes('quora')) {
    return createSvgBanner('#B92B27', '#4C0519', 'Q', 'Quora Q&A Task');
  }
  if (cat.includes('seo') || cat.includes('ads click') || cat.includes('visit')) {
    return createSvgBanner('#2563EB', '#1E1B4B', '🔍', 'SEO & Ad Click Task');
  }
  if (cat.includes('identity') || cat.includes('otp') || cat.includes('verification')) {
    return createSvgBanner('#0284C7', '#082F49', '🛡', 'Verification Task');
  }

  // Default IncomeZone Royal Golden Banner
  return createSvgBanner('#4C1D95', '#D97706', '💼', 'Micro-Job Task');
}

/**
 * Extracts the job thumbnail image URL from all possible sources:
 * 1. Direct fields (`image_url`, `imageUrl`, `job_image`, `jobImage`, `thumbnail_url`)
 * 2. Embedded in `description` or `instructions` using `[Thumbnail: ...]` tag
 * 3. Matched in localStorage `iz_fallback_jobs` by ID
 */
export function extractJobImageUrl(jobObj: any): string {
  if (!jobObj) return '';

  // 1. Direct properties
  const direct = 
    jobObj.image_url || 
    jobObj.imageUrl || 
    jobObj.job_image || 
    jobObj.jobImage || 
    jobObj.thumbnail_url || 
    jobObj.thumbnailUrl;

  if (direct && typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }

  // 2. Extracted from description / instructions tag
  const desc = jobObj.description || jobObj.instructions || '';
  if (desc && typeof desc === 'string') {
    const match = desc.match(/\[(?:Job Image|Thumbnail|Image):\s*([^\]]+)\]/i);
    if (match && match[1] && match[1].trim().length > 0) {
      return match[1].trim();
    }
  }

  // 3. Fallback matching in local jobs store
  if (jobObj.id) {
    try {
      const localJobs = getLocalJobs();
      const match = localJobs.find((j: any) => j.id === jobObj.id);
      if (match) {
        const localImg = match.image_url || (match as any).imageUrl || (match as any).jobImage;
        if (localImg && typeof localImg === 'string' && localImg.trim().length > 0) {
          return localImg.trim();
        }
        if (match.description) {
          const m = match.description.match(/\[(?:Job Image|Thumbnail|Image):\s*([^\]]+)\]/i);
          if (m && m[1]) return m[1].trim();
        }
      }
    } catch {}
  }

  return '';
}

/**
 * Cleans metadata tags (Text Proof, Screenshot instructions, Image tag) from description
 * to present pristine instructions to workers and employers.
 */
export function cleanJobDescription(desc: string): string {
  if (!desc) return '';
  return desc
    .replace(/\[Text Proof Required:[^\]]*\]/gi, '')
    .replace(/\[Screenshots Required:[^\]]*\]/gi, '')
    .replace(/\[(?:Job Image|Thumbnail|Image):[^\]]*\]/gi, '')
    .trim();
}

/**
 * Appends [Thumbnail: ...] tag to description so it survives database inserts
 * even when the jobs table does not have an image_url column.
 */
export function attachImageToDescription(description: string, imageUrl?: string): string {
  const clean = cleanJobDescription(description);
  if (!imageUrl || imageUrl.trim().length === 0) {
    return clean;
  }
  return `${clean}\n\n[Thumbnail: ${imageUrl.trim()}]`;
}

/**
 * Extracts an array of screenshot URLs from any submission row
 * (handles arrays, single URLs, base64 data URIs, and JSON-encoded string arrays).
 */
export function parseProofScreenshots(sub: any): string[] {
  if (!sub) return [];

  const result: string[] = [];
  const pushItem = (item: any) => {
    if (!item || typeof item !== 'string') return;
    const trimmed = item.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          parsed.forEach((p) => pushItem(p));
          return;
        }
      } catch {}
    }
    if (!result.includes(trimmed)) {
      result.push(trimmed);
    }
  };

  const candidates = [
    sub.proof_screenshot_urls,
    sub.proofScreenshotUrls,
    sub.proof_screenshot_url,
    sub.proofScreenshotUrl,
    sub.screenshotUrl,
    sub.proof_file_url,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      candidate.forEach((c) => pushItem(c));
    } else if (typeof candidate === 'string') {
      pushItem(candidate);
    }
  }

  return result;
}
