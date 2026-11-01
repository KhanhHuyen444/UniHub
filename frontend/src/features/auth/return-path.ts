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
  if (returnTo !== null) {
    const candidate = safeReturnPath(returnTo, origin);

    // Ngăn chặn tài khoản không phải Admin (như Student) bị điều hướng vào trang quản trị /admin/*
    if (
      (candidate === '/admin' || candidate.startsWith('/admin/')) &&
      role !== 'Admin'
    ) {
      return role === 'Student' ? '/' : '/opportunities';
    }

    // Ngăn chặn tài khoản Admin bị điều hướng vào các trang chỉ dành riêng cho Student
    if (
      (candidate === '/recommendations' ||
        candidate.startsWith('/recommendations/') ||
        candidate === '/profile' ||
        candidate.startsWith('/profile/')) &&
      role === 'Admin'
    ) {
      return '/admin/dashboard';
    }

    return candidate;
  }
  return role === 'Admin' ? '/admin/dashboard' : '/';
}
