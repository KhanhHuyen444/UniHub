export function safeReturnPath(
  value: string | null,
  origin = 'http://localhost',
): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/opportunities';
  }
  try {
    const parsed = new URL(value, origin);
    if (parsed.origin !== origin || parsed.pathname === '/login') {
      return '/opportunities';
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/opportunities';
  }
}

export function loginDestination(
  returnTo: string | null,
  role: 'Student' | 'Admin' | null,
  origin = 'http://localhost',
): string {
  if (returnTo !== null) return safeReturnPath(returnTo, origin);
  return role === 'Admin' ? '/admin/opportunities' : '/';
}
