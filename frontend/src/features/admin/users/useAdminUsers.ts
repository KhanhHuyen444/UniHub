import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../lib/api';
import { getAdminUsers, patchAdminUserRole } from './api';
import type {
  AdminUsersResponse,
  AdminUserRoleChangeResponse,
  UserRole,
} from './contracts';

export interface UseAdminUsersOptions {
  accessToken: string | null;
  role: string | null;
  initialPage?: number;
  initialPageSize?: number;
}

export function useAdminUsers({
  accessToken,
  role,
  initialPage = 1,
  initialPageSize = 20,
}: UseAdminUsersOptions) {
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [refreshIndex, setRefreshIndex] = useState(0);

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1); // Reset to page 1 on search change
    }, 300);

    return () => clearTimeout(handler);
  }, [searchInput]);

  const reload = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  // Fetch users list
  useEffect(() => {
    if (role !== 'Admin' || !accessToken) {
      setData(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    getAdminUsers(
      accessToken,
      {
        page,
        pageSize,
        q: debouncedSearch || undefined,
      },
      controller.signal,
    )
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (
          err instanceof Error &&
          (err.name === 'AbortError' || err.message.includes('aborted'))
        ) {
          return;
        }
        const message =
          err instanceof ApiError
            ? err.message
            : 'Không thể tải danh sách tài khoản.';
        setError(message);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [accessToken, role, page, pageSize, debouncedSearch, refreshIndex]);

  const changeRole = useCallback(
    async (
      targetUserId: number,
      newRole: UserRole,
    ): Promise<AdminUserRoleChangeResponse> => {
      if (!accessToken) {
        throw new ApiError('Cần đăng nhập Admin.', {
          code: 'UNAUTHORIZED',
          kind: 'request',
          status: 401,
        });
      }

      setIsMutating(true);
      setMutationError(null);
      setSuccessMessage(null);

      try {
        const result = await patchAdminUserRole(
          accessToken,
          targetUserId,
          newRole,
        );

        // Optimistically update list in state
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) =>
              item.id === targetUserId ? { ...item, role: newRole } : item,
            ),
          };
        });

        if (result.changed) {
          setSuccessMessage(
            `Đã cập nhật vai trò của tài khoản thành công sang ${newRole}.`,
          );
        } else {
          setSuccessMessage(
            `Tài khoản đã có vai trò ${newRole}, không có thay đổi.`,
          );
        }

        return result;
      } catch (err: unknown) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Không thể cập nhật vai trò người dùng.';
        setMutationError(message);
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [accessToken],
  );

  const clearFeedback = useCallback(() => {
    setSuccessMessage(null);
    setMutationError(null);
  }, []);

  return {
    data,
    loading,
    error,
    page,
    pageSize,
    searchInput,
    setSearchInput,
    goToPage: setPage,
    reload,
    changeRole,
    isMutating,
    mutationError,
    successMessage,
    clearFeedback,
  };
}
