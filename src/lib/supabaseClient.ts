import { createClient } from '@supabase/supabase-js';

// Access Supabase credentials with sanitized parsing
const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const isConfigured = rawUrl.startsWith('https://') && rawKey.length > 20;

if (!isConfigured) {
  console.warn(
    'Supabase Configuration Notice: Supabase URL or Anon Key is missing or using placeholder in environment secrets. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided in Settings > Secrets.'
  );
}

const supabaseUrl = isConfigured ? rawUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = isConfigured ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

export const isSupabaseConfigured = isConfigured;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export function toValidUUID(input: string): string {
  if (!input) return '00000000-0000-4000-8000-000000000000';
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(input)) return input;

  let hash1 = 0, hash2 = 0, hash3 = 0, hash4 = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash1 = ((hash1 << 5) - hash1 + char) | 0;
    hash2 = ((hash2 << 7) - hash2 + char * 3) | 0;
    hash3 = ((hash3 << 11) - hash3 + char * 7) | 0;
    hash4 = ((hash4 << 13) - hash4 + char * 11) | 0;
  }

  const h1 = Math.abs(hash1).toString(16).padStart(8, '0').substring(0, 8);
  const h2 = Math.abs(hash2).toString(16).padStart(4, '0').substring(0, 4);
  const h3 = '4' + Math.abs(hash3).toString(16).padStart(3, '0').substring(0, 3);
  const h4 = '8' + Math.abs(hash4).toString(16).padStart(3, '0').substring(0, 3);
  const h5 = (Math.abs(hash1 ^ hash2).toString(16) + Math.abs(hash3 ^ hash4).toString(16)).padStart(12, '0').substring(0, 12);

  return `${h1}-${h2}-${h3}-${h4}-${h5}`;
}

/**
 * Formats or generates a clean 8-digit Job ID starting with '9' (e.g. "92748624").
 */
export function formatJobDisplayId(displayId?: any, rawId?: string): string {
  if (displayId !== null && displayId !== undefined && displayId !== '') {
    let str = String(displayId).trim().replace(/^#/, '');
    if (/^\d{8}$/.test(str) && str.startsWith('9')) {
      return str;
    }
    if (!isNaN(Number(str)) && Number(str) > 0) {
      const numVal = Number(str);
      if (numVal >= 90000000 && numVal <= 99999999) {
        return String(numVal);
      }
      const padded = String(90000000 + (numVal % 90000000));
      return padded;
    }
    return str;
  }
  if (!rawId) return '92748624';
  let hash = 0;
  for (let i = 0; i < rawId.length; i++) {
    hash = (hash << 5) - hash + rawId.charCodeAt(i);
    hash |= 0;
  }
  const positive = (Math.abs(hash) % 89999999) + 10000000;
  return '9' + String(positive).slice(1);
}

/**
 * Formats or generates a clean sequential User ID (e.g. "10001").
 */
export function formatUserDisplayId(displayId?: any, rawId?: string): string {
  if (displayId !== null && displayId !== undefined && displayId !== '') {
    let str = String(displayId).trim().replace(/^#/, '');
    return str;
  }
  if (!rawId) return '10001';
  let hash = 0;
  for (let i = 0; i < rawId.length; i++) {
    hash = (hash << 5) - hash + rawId.charCodeAt(i);
    hash |= 0;
  }
  const positive = (Math.abs(hash) % 89999) + 10000;
  return '1' + String(positive).slice(1);
}

export default supabase;
