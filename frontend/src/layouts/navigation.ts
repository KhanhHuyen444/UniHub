export type ShellArea = 'public' | 'student' | 'admin';

export const sharedUiPreviewPath = '/_dev/ui';

export interface NavigationItem {
  key: string;
  label: string;
  href: string;
}

export const publicNavigation: NavigationItem[] = [
  { key: 'home', label: 'Trang chủ', href: '/' },
  { key: 'opportunities', label: 'Hub cơ hội', href: '/opportunities' },
  { key: 'roadmaps', label: 'Lộ trình kỹ năng', href: '/roadmaps' },
  { key: 'forum', label: 'Diễn đàn', href: '/forum' },
];

export const studentNavigation: NavigationItem[] = [
  ...publicNavigation.slice(0, 2),
  {
    key: 'recommendations',
    label: 'Cơ hội dành cho bạn',
    href: '/recommendations',
  },
  publicNavigation[2],
  { key: 'calendar', label: 'Lịch & Deadline', href: '/calendar' },
  publicNavigation[3],
];

export const adminNavigation: NavigationItem[] = [
  { key: 'dashboard', label: 'Dashboard thống kê', href: '/admin/dashboard' },
  {
    key: 'moderation',
    label: 'Kiểm duyệt nội dung',
    href: '/admin/opportunities',
  },
  { key: 'categories', label: 'Quản lý danh mục', href: '/admin/categories' },
  { key: 'users', label: 'Tài khoản & Phân quyền', href: '/admin/users' },
];

export function previewTarget(area: ShellArea, activeKey: string): string {
  const search = new URLSearchParams({ area, active: activeKey });
  return `${sharedUiPreviewPath}?${search.toString()}`;
}

export function navigationTarget(
  item: NavigationItem,
  area: ShellArea,
  previewNavigation: boolean,
): string {
  return previewNavigation ? previewTarget(area, item.key) : item.href;
}
