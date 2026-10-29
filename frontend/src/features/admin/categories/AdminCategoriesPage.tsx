import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  LoadingState,
} from '../../../components/ui';
import {
  createAdminCategory,
  renameAdminCategory,
  setAdminCategoryStatus,
} from './api';
import type { AdminCategory, CategoryType } from './contracts';
import {
  categoryError,
  useAdminCategories,
  type CategoryError,
} from './useAdminCategories';

export interface AdminCategoriesPageProps {
  accessToken: string | null;
  role: 'Admin' | 'Student' | null;
}
const messages: Record<string, string> = {
  DUPLICATE_CATEGORY: 'Tên danh mục đã tồn tại trong loại này.',
  LAST_ACTIVE_CATEGORY:
    'Không thể đóng danh mục Active cuối cùng của loại này.',
  VALIDATION_ERROR:
    'Dữ liệu không hợp lệ: tên 1–100 ký tự, lý do tối đa 500 ký tự.',
  INVALID_REQUEST: 'Dữ liệu yêu cầu không hợp lệ.',
  INVALID_ID: 'Mã danh mục không hợp lệ.',
  INVALID_QUERY: 'Bộ lọc danh mục không hợp lệ.',
  NOT_FOUND: 'Danh mục không còn tồn tại. Hãy tải lại danh sách.',
  UNAUTHORIZED:
    'Phiên đăng nhập không hợp lệ hoặc hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Chỉ Admin được quản lý danh mục.',
  SERVICE_UNAVAILABLE: 'Dịch vụ chưa sẵn sàng. Vui lòng thử lại.',
  NETWORK_ERROR:
    'Không kết nối được máy chủ. Với thao tác lưu, hãy tải lại danh sách để kiểm tra kết quả trước khi gửi lại.',
  INVALID_RESPONSE:
    'Dữ liệu trả về không đúng hợp đồng. Hãy tải lại danh sách để kiểm tra kết quả.',
};
const message = (error: CategoryError) =>
  messages[error.code] ??
  'Thao tác chưa thành công. Vui lòng tải lại để kiểm tra kết quả.';
const authError = (error: CategoryError | null) =>
  error?.httpStatus === 401 || error?.httpStatus === 403;
type Edit = { category: AdminCategory; kind: 'rename' | 'status' };

export function AdminCategoriesPage({
  accessToken,
  role,
}: AdminCategoriesPageProps) {
  if (!accessToken?.trim() || role === null)
    return (
      <ErrorState
        title="Cần đăng nhập Admin"
        description="Đăng nhập bằng tài khoản Admin để quản lý danh mục."
      />
    );
  if (role !== 'Admin')
    return (
      <ErrorState
        title="Không có quyền quản trị"
        description="Student không được quản lý danh mục."
      />
    );
  // Reset forms, request state and pending operations when the Auth owner changes
  // the token. The token is never rendered or persisted in browser storage.
  return <AdminCategoriesWorkspace key={accessToken} token={accessToken} />;
}

function AdminCategoriesWorkspace({ token }: { token: string }) {
  const [type, setType] = useState<CategoryType>('Major');
  const { state, reload } = useAdminCategories(token, type);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [edit, setEdit] = useState<Edit | null>(null);
  const [editName, setEditName] = useState('');
  const [editReason, setEditReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CategoryError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const refresh = () => {
    setError(null);
    setEdit(null);
    setNotice(null);
    reload();
  };
  const save = async (
    action: (signal: AbortSignal) => Promise<{ changed?: boolean }>,
    afterSave?: () => void,
  ) => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await action(controller.signal);
      if (controller.signal.aborted) return;
      setNotice(
        result.changed === false ? 'Không có thay đổi.' : 'Đã lưu danh mục.',
      );
      afterSave?.();
      setEdit(null);
      reload();
    } catch (failure) {
      if (!controller.signal.aborted) setError(categoryError(failure));
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  };
  const submitCreate = (event: FormEvent) => {
    event.preventDefault();
    void save(
      async (signal) => {
        await createAdminCategory(token, type, name, reason || null, signal);
        return {};
      },
      () => {
        setName('');
        setReason('');
      },
    );
  };
  const submitEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!edit) return;
    void save((signal) =>
      edit.kind === 'rename'
        ? renameAdminCategory(
            token,
            edit.category.id,
            editName,
            editReason || null,
            signal,
          )
        : setAdminCategoryStatus(
            token,
            edit.category.id,
            edit.category.status === 'Active' ? 'Closed' : 'Active',
            editReason || null,
            signal,
          ),
    );
  };
  const denied = authError(error)
    ? error
    : state.status === 'error' && authError(state.error)
      ? state.error
      : null;
  if (denied)
    return (
      <ErrorState
        title="Không được truy cập danh mục Admin"
        description={message(denied)}
        onRetry={refresh}
      />
    );
  const locked = busy || state.status !== 'success';
  return (
    <section className="grid gap-6" aria-label="Quản lý danh mục">
      <h1 className="type-title font-semibold text-navy">Quản lý danh mục</h1>
      <div className="flex gap-3" aria-label="Loại danh mục">
        {(['Major', 'Skill'] as const).map((value) => (
          <Button
            key={value}
            variant={type === value ? 'primary' : 'outline'}
            aria-pressed={type === value}
            disabled={busy}
            onClick={() => {
              setType(value);
              setEdit(null);
              setError(null);
              setNotice(null);
              setName('');
              setReason('');
            }}
          >
            {value}
          </Button>
        ))}
      </div>
      {notice && (
        <p role="status" className="type-label text-navy">
          {notice}
        </p>
      )}
      {error && (
        <ErrorState
          title="Không lưu được danh mục"
          description={message(error)}
        >
          <Button variant="outline" disabled={busy} onClick={refresh}>
            Tải lại danh sách
          </Button>
        </ErrorState>
      )}
      <form onSubmit={submitCreate} aria-label="Tạo danh mục">
        <fieldset
          disabled={locked}
          className="grid gap-3 rounded-card border border-line bg-white p-5"
        >
          <legend className="type-label font-semibold">Tạo {type}</legend>
          <FormField id="category-create-name" label="Tên danh mục" required>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <FormField id="category-create-reason" label="Lý do tạo (tùy chọn)">
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          <Button type="submit" loading={busy}>
            Tạo danh mục
          </Button>
        </fieldset>
      </form>
      {state.status === 'loading' && <LoadingState title="Đang tải danh mục" />}
      {state.status === 'error' && (
        <ErrorState
          title="Không tải được danh mục"
          description={message(state.error)}
          onRetry={busy ? undefined : reload}
        />
      )}
      {state.status === 'success' && (
        <>
          <Button variant="outline" disabled={busy} onClick={refresh}>
            Tải lại danh sách
          </Button>
          {state.items.length === 0 ? (
            <EmptyState
              title="Chưa có danh mục"
              description={`Chưa có ${type}. Bạn có thể tạo danh mục mới.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white text-left type-label">
                <caption className="sr-only">Danh sách {type}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-3">
                      Tên
                    </th>
                    <th scope="col" className="p-3">
                      Trạng thái
                    </th>
                    <th scope="col" className="p-3">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((category) => (
                    <tr key={category.id} className="border-t border-line">
                      <td className="p-3">{category.name}</td>
                      <td className="p-3">{category.status}</td>
                      <td className="flex gap-2 p-3">
                        {(['rename', 'status'] as const).map((kind) => (
                          <Button
                            key={kind}
                            variant="outline"
                            disabled={busy}
                            aria-label={`${kind === 'rename' ? 'Đổi tên' : category.status === 'Active' ? 'Đóng' : 'Mở lại'} ${category.name}`}
                            onClick={() => {
                              setEdit({ category, kind });
                              setEditName(category.name);
                              setEditReason('');
                              setError(null);
                              setNotice(null);
                            }}
                          >
                            {kind === 'rename'
                              ? 'Đổi tên'
                              : category.status === 'Active'
                                ? 'Đóng'
                                : 'Mở lại'}
                          </Button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {edit && (
        <form aria-label="Chỉnh sửa danh mục" onSubmit={submitEdit}>
          <fieldset
            disabled={locked}
            className="grid gap-3 rounded-card border border-line bg-white p-5"
          >
            <legend className="type-label font-semibold">
              {edit.kind === 'rename'
                ? 'Đổi tên'
                : edit.category.status === 'Active'
                  ? 'Đóng'
                  : 'Mở lại'}
              : {edit.category.name}
            </legend>
            {edit.kind === 'rename' ? (
              <FormField id="category-edit-name" label="Tên mới" required>
                <Input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </FormField>
            ) : (
              <p>
                Chuyển trạng thái sang{' '}
                {edit.category.status === 'Active' ? 'Closed' : 'Active'}. Các
                liên kết hiện có được giữ nguyên.
              </p>
            )}
            <FormField
              id="category-edit-reason"
              label="Lý do thay đổi (tùy chọn)"
            >
              <Input
                value={editReason}
                onChange={(event) => setEditReason(event.target.value)}
              />
            </FormField>
            <div className="flex gap-3">
              <Button type="submit" loading={busy}>
                Lưu thay đổi
              </Button>
              <Button variant="outline" onClick={() => setEdit(null)}>
                Hủy
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
