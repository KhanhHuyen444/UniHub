import { useEffect, useId, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
} from '../../../components/ui';
import { useAuth } from '../../auth/AuthProvider';
import { getAccessToken } from '../../auth/auth-state';
import { UserAvatar } from '../../profile/UserAvatar';
import type { AdminUserItem, UserRole } from './contracts';
import { useAdminUsers } from './useAdminUsers';

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function RefreshIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

export interface AdminUsersPageProps {
  accessToken?: string | null;
  role?: string | null;
  currentUserId?: number | null;
}

export function AdminUsersPage({
  accessToken: propAccessToken,
  role: propRole,
  currentUserId: propCurrentUserId,
}: AdminUsersPageProps) {
  const auth = useAuth();
  const accessToken = propAccessToken ?? getAccessToken();
  const role = propRole ?? auth.user?.role ?? null;
  const currentUserId = propCurrentUserId ?? auth.user?.id ?? null;

  const {
    data,
    loading,
    error,
    page,
    searchInput,
    setSearchInput,
    goToPage,
    reload,
    changeRole,
    isMutating,
    mutationError,
    successMessage,
    clearFeedback,
  } = useAdminUsers({
    accessToken,
    role,
  });

  const [confirmTarget, setConfirmTarget] = useState<{
    user: AdminUserItem;
    targetRole: UserRole;
  } | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputId = useId();

  // Close dialog on Escape
  useEffect(() => {
    if (!confirmTarget) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setConfirmTarget(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmTarget]);

  if (role !== 'Admin') {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ErrorState
          title="Từ chối truy cập"
          description="Chức năng quản lý tài khoản và phân quyền chỉ dành cho Quản trị viên UniHub."
        />
      </main>
    );
  }

  async function handleConfirmRoleChange() {
    if (!confirmTarget) return;

    try {
      await changeRole(confirmTarget.user.id, confirmTarget.targetRole);
      setConfirmTarget(null);
    } catch {
      // Error is set in hook mutationError
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-navy">
          Tài khoản & Phân quyền
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Quản lý danh sách người dùng và điều chỉnh vai trò tài khoản (Student
          / Admin) theo đúng hợp đồng bảo mật.
        </p>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 flex items-center justify-between rounded-card border border-success-line bg-success-surface p-4 text-sm font-medium text-success"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true">✔</span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={clearFeedback}
            className="flex h-7 w-7 items-center justify-center rounded-control text-success hover:bg-success/10 hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-success"
            aria-label="Đóng thông báo thành công"
            title="Đóng thông báo"
          >
            <CloseIcon className="h-4 w-4" />
            <span className="sr-only">Đóng</span>
          </button>
        </div>
      )}

      {/* Mutation Error Notification Banner */}
      {mutationError && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 flex items-center justify-between rounded-card border border-danger-line bg-danger-surface p-4 text-sm font-medium text-danger"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true">⚠</span>
            <span>{mutationError}</span>
          </div>
          <button
            type="button"
            onClick={clearFeedback}
            className="flex h-7 w-7 items-center justify-center rounded-control text-danger hover:bg-danger/10 hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
            aria-label="Đóng thông báo lỗi"
            title="Đóng thông báo"
          >
            <CloseIcon className="h-4 w-4" />
            <span className="sr-only">Đóng</span>
          </button>
        </div>
      )}

      {/* Search and Filters Card */}
      <Card className="mb-6 p-4 transition-all duration-300 hover:shadow-md hover:border-brand/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-md">
            <label htmlFor={searchInputId} className="sr-only">
              Tìm kiếm theo họ tên hoặc email
            </label>
            <div className="relative">
              <Input
                id={searchInputId}
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm kiếm theo họ tên hoặc email..."
                className="pr-9"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-secondary hover:text-navy hover:scale-110 active:scale-95 transition-all duration-200"
                  aria-label="Xóa nội dung tìm kiếm"
                  title="Xóa tìm kiếm"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="neutral"
              size="icon"
              onClick={reload}
              loading={loading}
              disabled={loading}
              aria-label="Làm mới"
              title="Làm mới"
            >
              {!loading && <RefreshIcon className="h-4 w-4 text-secondary" />}
              <span className="sr-only">Làm mới</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {loading && !data ? (
        <LoadingState
          title="Đang tải danh sách tài khoản"
          description="Vui lòng chờ trong giây lát..."
        />
      ) : error ? (
        <ErrorState
          title="Không thể tải danh sách tài khoản"
          description={error}
          onRetry={reload}
          retryLabel="Thử lại"
        />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="Không tìm thấy tài khoản nào"
          description={
            searchInput.trim()
              ? `Không có kết quả nào khớp với "${searchInput}".`
              : 'Chưa có tài khoản người dùng nào trong hệ thống.'
          }
        >
          {searchInput.trim() && (
            <Button variant="outline" onClick={() => setSearchInput('')}>
              Xóa bộ lọc tìm kiếm
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {/* Users Table */}
          <div className="overflow-hidden rounded-card border border-line bg-white shadow-subtle transition-all duration-300 hover:shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface/60 text-xs font-semibold uppercase tracking-wider text-secondary">
                    <th scope="col" className="px-5 py-3.5">
                      Người dùng
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Chuyên ngành
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Năm học
                    </th>
                    <th scope="col" className="px-5 py-3.5">
                      Vai trò
                    </th>
                    <th scope="col" className="px-5 py-3.5 text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((user) => {
                    const isSelf = currentUserId === user.id;
                    const nextRole: UserRole =
                      user.role === 'Admin' ? 'Student' : 'Admin';

                    return (
                      <tr
                        key={user.id}
                        className="transition-colors duration-150 hover:bg-slate-50/80"
                      >
                        {/* User Identity Column */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="transition-transform duration-200 hover:scale-105">
                              <UserAvatar name={user.fullName} url={null} />
                            </div>
                            <div>
                              <div className="font-medium text-navy">
                                {user.fullName}
                                {isSelf && (
                                  <span className="ml-2 rounded-pill bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-secondary">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Major Column */}
                        <td className="px-5 py-4 text-ink">
                          {user.major ? user.major.name : '—'}
                        </td>

                        {/* Academic Year Column */}
                        <td className="px-5 py-4 text-ink">
                          {user.academicYear ? `Năm ${user.academicYear}` : '—'}
                        </td>

                        {/* Role Badge Column */}
                        <td className="px-5 py-4">
                          <Badge
                            variant={user.role === 'Admin' ? 'warning' : 'info'}
                          >
                            {user.role}
                          </Badge>
                        </td>

                        {/* Actions Column */}
                        <td className="px-5 py-4 text-right">
                          {isSelf ? (
                            <span
                              className="inline-block text-xs font-medium text-muted"
                              title="Không thể tự hạ quyền của chính mình theo quy định BR-14.4"
                            >
                              Tài khoản hiện tại
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="compact"
                              disabled={isMutating}
                              onClick={() =>
                                setConfirmTarget({
                                  user,
                                  targetRole: nextRole,
                                })
                              }
                            >
                              {user.role === 'Admin'
                                ? 'Hạ quyền Sinh viên'
                                : 'Nâng quyền Admin'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-4 sm:flex-row">
              <div className="text-xs text-secondary">
                Trang{' '}
                <span className="font-semibold text-navy">
                  {data.meta.page}
                </span>{' '}
                /{' '}
                <span className="font-semibold text-navy">
                  {data.meta.totalPages || 1}
                </span>{' '}
                (Tổng cộng{' '}
                <span className="font-semibold text-navy">
                  {data.meta.total}
                </span>{' '}
                tài khoản)
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="neutral"
                  size="compact"
                  disabled={page <= 1 || loading}
                  onClick={() => goToPage(Math.max(1, page - 1))}
                >
                  Trang trước
                </Button>
                <Button
                  variant="neutral"
                  size="compact"
                  disabled={page >= data.meta.totalPages || loading}
                  onClick={() => goToPage(page + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Dialog */}
      {confirmTarget && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmTarget(null);
            }
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="relative w-full max-w-md rounded-card border border-line bg-white p-6 shadow-float"
          >
            <button
              type="button"
              onClick={() => setConfirmTarget(null)}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-control text-secondary hover:bg-surface hover:text-navy hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-label="Đóng hộp thoại"
              title="Đóng"
            >
              <CloseIcon className="h-4 w-4" />
              <span className="sr-only">Đóng</span>
            </button>
            <h2
              id="confirm-dialog-title"
              className="pr-8 text-lg font-bold text-navy"
            >
              Xác nhận thay đổi vai trò
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-secondary">
              Bạn có chắc chắn muốn thay đổi vai trò của người dùng{' '}
              <strong className="text-navy">
                {confirmTarget.user.fullName}
              </strong>{' '}
              ({confirmTarget.user.email}) từ{' '}
              <Badge
                variant={
                  confirmTarget.user.role === 'Admin' ? 'warning' : 'info'
                }
              >
                {confirmTarget.user.role}
              </Badge>{' '}
              sang{' '}
              <Badge
                variant={
                  confirmTarget.targetRole === 'Admin' ? 'warning' : 'info'
                }
              >
                {confirmTarget.targetRole}
              </Badge>
              ?
            </p>

            <div className="mt-4 rounded-compact bg-surface p-3 text-xs leading-relaxed text-secondary">
              <strong className="text-navy">Lưu ý bảo mật:</strong> Thao tác này
              sẽ được ghi vào nhật ký hệ thống (Activity Log). Quyền mới sẽ có
              hiệu lực trong lần cấp token kế tiếp của người dùng.
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="neutral"
                onClick={() => setConfirmTarget(null)}
                disabled={isMutating}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmRoleChange}
                loading={isMutating}
                disabled={isMutating}
              >
                Xác nhận thay đổi
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
