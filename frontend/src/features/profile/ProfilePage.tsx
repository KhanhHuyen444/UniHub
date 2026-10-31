import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { safeReturnPath } from '../auth/return-path';
import { useAuth } from '../auth/AuthProvider';
import { getAccessToken } from '../auth/auth-state';
import { SkillOptionsField } from '../categories/SkillOptionsField';
import { getMajorOptions } from '../opportunities/api';
import type { MajorOption } from '../opportunities/contracts';
import { ApiError } from '../../lib/api';
import { Button, ErrorState, LoadingState } from '../../components/ui';
import { getProfile, saveProfile } from './api';
import { isCurrentProfileSession } from './session';
import {
  toForm,
  toInput,
  validateForm,
  type ProfileResponse,
  type ProfileForm,
} from './contracts';

export function ProfilePage() {
  const { status, user } = useAuth();
  if (status !== 'authenticated' || user?.role !== 'Student') return null;
  // A new identity gets a fresh component and cannot see the previous form.
  return <ProfileEditor key={user.id} userId={user.id} />;
}
function ProfileEditor({ userId }: { userId: number }) {
  const { user } = useAuth();
  const [query] = useSearchParams();
  const returnTo = safeReturnPath(
    query.get('returnTo'),
    window.location.origin,
  );
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [majors, setMajors] = useState<MajorOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const saveRequest = useRef<AbortController | null>(null);
  useEffect(() => () => saveRequest.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setForm(null);
    setLoadError(null);
    Promise.all([
      getProfile(controller.signal),
      getMajorOptions(controller.signal),
    ]).then(
      ([profile, options]) => {
        if (!isCurrentProfileSession(userId, controller.signal)) return;
        setData(profile);
        setForm(toForm(profile.profile));
        setMajors(options);
      },
      (error: unknown) => {
        if (isCurrentProfileSession(userId, controller.signal))
          setLoadError(
            error instanceof ApiError
              ? `${error.message} (${error.code})`
              : 'Không tải được hồ sơ.',
          );
      },
    );
    return () => controller.abort();
  }, [attempt, userId]);
  if (loadError)
    return (
      <ErrorState
        title="Không tải được hồ sơ"
        description={loadError}
        onRetry={() => setAttempt((a) => a + 1)}
      />
    );
  if (!data || !form) return <LoadingState title="Đang tải hồ sơ" />;
  const change = (patch: Partial<ProfileForm>) => {
    setForm({ ...form, ...patch });
    setMessage('');
    setErrors({});
  };
  const fieldError = (field: string) =>
    errors[field] ? (
      <p id={`${field}-error`} role="alert" className="text-red-700">
        {errors[field]}
      </p>
    ) : null;
  const submit = async () => {
    const validation = validateForm(form);
    setErrors(validation);
    setMessage('');
    if (Object.keys(validation).length || saving) return;
    const controller = new AbortController();
    saveRequest.current = controller;
    setSaving(true);
    try {
      const result = await saveProfile(toInput(form), controller.signal);
      if (!isCurrentProfileSession(userId, controller.signal)) return;
      setData(result);
      setForm(toForm(result.profile));
      setMessage('Đã lưu hồ sơ thành công.');
    } catch (error) {
      if (!isCurrentProfileSession(userId, controller.signal)) return;
      if (error instanceof ApiError) {
        setErrors(
          Object.fromEntries(
            (error.fieldErrors ?? [])
              .filter((e) => e.source === 'body')
              .map((e) => [e.field, e.message]),
          ),
        );
        setMessage(
          error.code === 'CATEGORY_CLOSED'
            ? 'Danh mục đã đóng trong lúc lưu. Dữ liệu nhập được giữ lại; vui lòng kiểm tra lựa chọn hoặc tải lại trang.'
            : `${error.message} (${error.code})`,
        );
      } else setMessage('Không lưu được hồ sơ. Vui lòng thử lại.');
    } finally {
      if (isCurrentProfileSession(userId, controller.signal)) setSaving(false);
    }
  };
  const closedMajor =
    data.profile.major?.status === 'Closed' ? data.profile.major : null;
  return (
    <section>
      <h1 className="text-[32px] font-bold leading-10 text-navy">
        Hồ sơ cá nhân
      </h1>
      <p className="mt-1 text-sm text-muted">
        Cập nhật chuyên ngành, năm học và kỹ năng để UniHub gợi ý cơ hội phù hợp
        với bạn.
      </p>
      <form
        className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,2.06fr)_minmax(0,1fr)]"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid min-w-0 gap-6">
          <section
            className="rounded-card bg-white p-6 shadow-public-card"
            aria-labelledby="google-heading"
          >
            <h2 id="google-heading" className="text-lg font-semibold text-navy">
              Tài khoản Google
            </h2>
            <div className="mt-4 flex items-center gap-4">
              <UserAvatar
                name={user?.fullName ?? ''}
                url={user?.avatarUrl ?? null}
                className="h-12 w-12 text-lg"
              />
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                <label className="grid min-w-0 gap-1 text-sm text-secondary">
                  Họ và tên
                  <input
                    readOnly
                    value={user?.fullName ?? ''}
                    className="w-full min-w-0 rounded-control bg-surface px-3 py-2 text-ink"
                  />
                </label>
                <label className="grid min-w-0 gap-1 text-sm text-secondary">
                  Email
                  <input
                    readOnly
                    value={user?.email ?? ''}
                    className="w-full min-w-0 rounded-control bg-surface px-3 py-2 text-ink"
                  />
                </label>
              </div>
            </div>
            <p className="mt-4 rounded-control bg-surface p-3 text-sm text-muted">
              ⓘ Thông tin lấy từ tài khoản Google, không thể sửa tại đây.
            </p>
          </section>
          <section
            className="rounded-card bg-white p-6 shadow-public-card"
            aria-labelledby="academic-heading"
          >
            <h2
              id="academic-heading"
              className="mb-6 text-2xl font-semibold text-ink"
            >
              Hồ sơ học thuật
            </h2>
            <fieldset disabled={saving} className="grid min-w-0 gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  Chuyên ngành
                  <select
                    value={form.majorId}
                    onChange={(e) => change({ majorId: e.target.value })}
                    aria-invalid={!!errors.majorId}
                    aria-describedby={
                      errors.majorId ? 'majorId-error' : undefined
                    }
                    className="rounded-control border border-line p-3"
                  >
                    <option value="">Chọn chuyên ngành</option>
                    {closedMajor && (
                      <option value={closedMajor.id}>
                        {closedMajor.name} (Đã đóng — liên kết hiện tại)
                      </option>
                    )}
                    {majors
                      .filter((m) => m.id !== closedMajor?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                  </select>
                  {fieldError('majorId')}
                </label>
                <label className="grid gap-2">
                  Năm học
                  <select
                    value={form.academicYear}
                    onChange={(e) => change({ academicYear: e.target.value })}
                    aria-invalid={!!errors.academicYear}
                    aria-describedby={
                      errors.academicYear ? 'academicYear-error' : undefined
                    }
                    className="rounded-control border border-line p-3"
                  >
                    <option value="">Chọn năm học</option>
                    {[1, 2, 3, 4].map((y) => (
                      <option key={y} value={y}>
                        Năm {y}
                      </option>
                    ))}
                  </select>
                  {fieldError('academicYear')}
                </label>
              </div>
              {!majors.length && (
                <p className="text-sm text-muted">
                  Hiện chưa có chuyên ngành Active để chọn mới.
                </p>
              )}
              <SkillOptionsField
                searchable
                accessToken={getAccessToken()}
                role="Student"
                selectedIds={form.skillIds}
                onChange={(skillIds) => change({ skillIds })}
                disabled={saving}
              />
              {data.profile.skills
                .filter(
                  (s) => s.status === 'Closed' && form.skillIds.includes(s.id),
                )
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span>{s.name} (Đã đóng)</span>
                    <Button
                      type="button"
                      onClick={() =>
                        change({
                          skillIds: form.skillIds.filter((id) => id !== s.id),
                        })
                      }
                    >
                      Gỡ {s.name}
                    </Button>
                  </div>
                ))}
              {fieldError('skillIds')}
              <label className="grid gap-2">
                Mục tiêu nghề nghiệp (không bắt buộc)
                <input
                  value={form.careerGoal}
                  onChange={(e) => change({ careerGoal: e.target.value })}
                  aria-invalid={!!errors.careerGoal}
                  className="rounded-control border border-line p-3"
                  placeholder="Ví dụ: Thực tập sinh Frontend"
                  aria-describedby={
                    errors.careerGoal ? 'careerGoal-error' : undefined
                  }
                />
                {fieldError('careerGoal')}
              </label>
            </fieldset>
          </section>
        </div>
        <aside
          className="rounded-card bg-white p-6 shadow-public-card"
          aria-label="Trạng thái hồ sơ"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-ink">Trạng thái hồ sơ</h2>
            <span
              role="status"
              className={`rounded-full px-3 py-1 text-xs ${data.isComplete ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}
            >
              {data.isComplete ? 'Hồ sơ đã hoàn thiện' : '• Chưa đầy đủ'}
            </span>
          </div>
          <p className="my-4 text-sm text-secondary">
            Hoàn thiện 3 thông tin bắt buộc dưới đây để mở khóa gợi ý thực tập
            và lộ trình kỹ năng cá nhân hóa:
          </p>
          <ul className="grid gap-3">
            {[
              { label: 'Chuyên ngành', done: !!form.majorId },
              {
                label: 'Năm học',
                done: ['1', '2', '3', '4'].includes(form.academicYear),
              },
              { label: 'Ít nhất một kỹ năng', done: form.skillIds.length > 0 },
            ].map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2 rounded-control bg-surface p-3 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={item.done ? 'text-green-700' : 'text-amber-700'}
                >
                  {item.done ? '✓' : '×'}
                </span>
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-muted">
                  {item.done ? 'Đã chọn' : 'Chưa chọn'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Các lựa chọn chỉ được cập nhật vào hồ sơ sau khi lưu thành công.
          </p>
          <button
            className="mt-6 w-full rounded-control bg-brand px-4 py-3 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
            type="submit"
            disabled={saving}
          >
            {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </button>
          <Link
            to={returnTo.startsWith('/profile') ? '/opportunities' : returnTo}
            className="mt-2 block rounded-control bg-surface p-3 text-center text-sm text-brand"
          >
            Để sau
          </Link>
          {message && (
            <p role="status" className="mt-3 text-sm">
              {message}
            </p>
          )}
          <p className="mt-4 rounded-control bg-surface p-3 text-sm text-secondary">
            ✧ Bạn luôn có thể quay lại điều chỉnh và bổ sung hồ sơ sau trong mục
            Hồ sơ cá nhân.
          </p>
          <Link
            to="/recommendations"
            className="mt-4 block text-center text-sm text-brand"
          >
            Cơ hội dành cho bạn →
          </Link>
        </aside>
      </form>
    </section>
  );
}
