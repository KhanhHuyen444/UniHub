import { ProfileIcon } from './ProfileIcon';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { UserAvatar } from './UserAvatar';
import { useAuth } from '../auth/AuthProvider';
import { getAccessToken } from '../auth/auth-state';
import { SkillOptionsField } from '../categories/SkillOptionsField';
import { getCareersForMajor } from '../categories/major-skill-mapping';
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
  const navigate = useNavigate();
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
    const validation = validateForm(form, { requireCareerGoal: true });
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
      navigate('/', { replace: true, state: { profileSaved: true } });
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
  const selectedMajorName =
    majors.find((m) => String(m.id) === String(form.majorId))?.name ??
    (closedMajor && String(closedMajor.id) === String(form.majorId)
      ? closedMajor.name
      : null);
  const availableCareers = getCareersForMajor(selectedMajorName);
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
            className="rounded-card bg-white p-6 shadow-soft"
            aria-labelledby="google-heading"
          >
            <h2
              id="google-heading"
              className="flex items-center gap-2 text-lg font-semibold text-navy"
            >
              <ProfileIcon name="account" /> Tài khoản Google
            </h2>
            <div className="mt-4 flex items-end gap-4">
              <UserAvatar
                name={user?.fullName ?? ''}
                url={user?.avatarUrl ?? null}
                className="mb-1 h-12 w-12 text-lg"
              />
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                <label className="grid min-w-0 gap-1 text-sm font-medium text-secondary">
                  Họ và tên
                  <input
                    readOnly
                    value={user?.fullName ?? ''}
                    className="w-full min-w-0 rounded-control bg-surface px-3 py-2.5 font-normal text-ink"
                  />
                </label>
                <label className="grid min-w-0 gap-1 text-sm font-medium text-secondary">
                  Email
                  <span className="relative">
                    <input
                      readOnly
                      value={user?.email ?? ''}
                      className="w-full min-w-0 rounded-control bg-surface py-2.5 pl-3 pr-9 font-normal text-ink"
                    />
                    <ProfileIcon
                      name="lock"
                      className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted"
                    />
                  </span>
                </label>
              </div>
            </div>
            <p className="mt-4 flex items-center gap-2 rounded-control bg-surface p-3 text-sm text-muted">
              <ProfileIcon name="info" className="h-5 w-5 text-brand" /> Thông
              tin lấy từ tài khoản Google, không thể sửa tại đây.
            </p>
          </section>
          <section
            className="rounded-card bg-white p-6 shadow-soft"
            aria-labelledby="academic-heading"
          >
            <h2
              id="academic-heading"
              className="mb-6 flex items-center gap-2 text-2xl font-semibold text-ink"
            >
              <ProfileIcon name="academic" className="h-6 w-6 text-brand" /> Hồ
              sơ học thuật
            </h2>
            <fieldset disabled={saving} className="grid min-w-0 gap-5 text-sm">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span>
                    Chuyên ngành{' '}
                    <span aria-hidden="true" className="text-red-600">
                      *
                    </span>
                  </span>
                  <select
                    aria-label="Chuyên ngành"
                    aria-required="true"
                    value={form.majorId}
                    onChange={(e) => change({ majorId: e.target.value })}
                    aria-invalid={!!errors.majorId}
                    aria-describedby={
                      errors.majorId ? 'majorId-error' : undefined
                    }
                    className="min-w-0 rounded-control border border-slate-100 bg-white px-3 py-2.5 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <option value="">Chọn chuyên ngành đào tạo...</option>
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
                  <span>
                    Năm học{' '}
                    <span aria-hidden="true" className="text-red-600">
                      *
                    </span>
                  </span>
                  <select
                    aria-label="Năm học"
                    aria-required="true"
                    value={form.academicYear}
                    onChange={(e) => change({ academicYear: e.target.value })}
                    aria-invalid={!!errors.academicYear}
                    aria-describedby={
                      errors.academicYear ? 'academicYear-error' : undefined
                    }
                    className="min-w-0 rounded-control border border-slate-100 bg-white px-3 py-2.5 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <option value="">Chọn năm học...</option>
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
              <div className="grid gap-2">
                <label className="grid gap-2">
                  <span className="flex items-center justify-between gap-2">
                    <span>
                      Vị trí nghề nghiệp mục tiêu{' '}
                      <span aria-hidden="true" className="text-red-600">
                        *
                      </span>
                    </span>
                  </span>
                  <select
                    aria-label="Vị trí nghề nghiệp mục tiêu"
                    aria-required="true"
                    value={form.careerGoal}
                    onChange={(e) => change({ careerGoal: e.target.value })}
                    aria-invalid={!!errors.careerGoal}
                    aria-describedby={
                      errors.careerGoal ? 'careerGoal-error' : undefined
                    }
                    disabled={!selectedMajorName}
                    className="min-w-0 rounded-control border border-slate-100 bg-white px-3 py-2.5 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:bg-slate-50 disabled:text-muted"
                  >
                    <option value="">
                      {selectedMajorName
                        ? 'Chọn vị trí nghề nghiệp mục tiêu...'
                        : 'Vui lòng chọn chuyên ngành trước...'}
                    </option>
                    {/* Giữ lại giá trị cũ đã lưu nếu không thuộc danh mục gợi ý để không âm thầm mất dữ liệu */}
                    {form.careerGoal &&
                      !availableCareers.some(
                        (c) =>
                          c.name.toLowerCase() ===
                          form.careerGoal.trim().toLowerCase(),
                      ) && (
                        <option value={form.careerGoal}>
                          {form.careerGoal} (Giá trị hiện tại)
                        </option>
                      )}
                    {availableCareers.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {fieldError('careerGoal')}
                </label>
                {availableCareers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="font-medium text-muted">Chọn nhanh:</span>
                    {availableCareers.map((c) => {
                      const isSelected =
                        form.careerGoal.trim().toLowerCase() ===
                        c.name.toLowerCase();
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() =>
                            change({ careerGoal: isSelected ? '' : c.name })
                          }
                          className={`cursor-pointer rounded-full px-3 py-1 transition-colors ${
                            isSelected
                              ? 'bg-brand font-medium text-white shadow-xs'
                              : 'border border-line bg-surface text-secondary hover:border-brand hover:text-brand'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <SkillOptionsField
                accessToken={getAccessToken()}
                role="Student"
                selectedIds={form.skillIds}
                onChange={(skillIds) => change({ skillIds })}
                disabled={saving}
                selectedMajorName={selectedMajorName}
                selectedCareerName={form.careerGoal}
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
            </fieldset>
          </section>
        </div>
        <aside
          className="rounded-card bg-white p-6 shadow-soft"
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
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${item.done ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}
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
          <p className="sr-only">
            Các lựa chọn chỉ được cập nhật vào hồ sơ sau khi lưu thành công.
          </p>
          <button
            className="mt-8 flex h-10 w-full items-center justify-center gap-2 rounded-control bg-brand px-4 text-sm font-medium text-white shadow-button transition-all duration-200 ease-out hover:brightness-95 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60 disabled:transform-none"
            type="submit"
            disabled={saving}
          >
            {!saving && <ProfileIcon name="check" className="h-4 w-4" />}
            {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </button>
          <Link
            to="/"
            className="mt-2 flex h-10 items-center justify-center rounded-control bg-surface text-sm text-brand border border-line transition-all duration-200 ease-out hover:bg-slate-100 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            Để sau
          </Link>
          {message && (
            <p role="status" className="mt-3 text-sm">
              {message}
            </p>
          )}
          <p className="mt-4 flex items-start gap-2 rounded-control bg-surface p-3 text-sm text-secondary">
            <ProfileIcon name="sparkles" className="h-5 w-5 text-brand" />
            <span>
              Bạn luôn có thể quay lại điều chỉnh và bổ sung hồ sơ sau trong mục
              Hồ sơ cá nhân.
            </span>
          </p>
          {data.isComplete && (
            <Link
              to="/recommendations"
              className="mt-4 block text-center text-sm text-brand"
            >
              Cơ hội dành cho bạn →
            </Link>
          )}
        </aside>
      </form>
    </section>
  );
}
