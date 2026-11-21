export const ADMIN_EMAILS: string[] = [
  'incomezone2729@gmail.com',
];

export const ADMIN_USERNAMES: string[] = [];

export function checkIsAdmin(
  user: {
    email?: string | null;
    username?: string | null;
    role?: string | null;
    user_metadata?: { role?: string; username?: string };
  } | null | undefined
): boolean {
  if (!user) return false;
  
  const email = (user.email || '').toLowerCase().trim();
  const username = (user.username || user.user_metadata?.username || '').toLowerCase().trim();
  const role = (user.role || user.user_metadata?.role || '').toLowerCase().trim();

  if (role === 'admin') return true;
  if (email && ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email)) return true;
  if (username && ADMIN_USERNAMES.some((adminUser) => adminUser.toLowerCase() === username)) return true;
  
  return false;
}
