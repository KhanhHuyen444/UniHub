import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
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
    <section className="mx-auto max-w-3xl rounded-card border border-line bg-white p-8">
      <h1 className="type-heading text-ink">Hồ sơ học thuật</h1>
      <p className="my-4" role="status">
        {data.isComplete
          ? 'Hồ sơ đã hoàn thiện'
          : 'Hồ sơ chưa thiết lập đầy đủ. Chọn chuyên ngành, năm học và ít nhất một kỹ năng để hoàn thiện.'}
      </p>
      <form
        className="grid gap-5"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset disabled={saving} className="grid gap-5">
          <label className="grid gap-2">
            Chuyên ngành
            <select
              value={form.majorId}
              onChange={(e) => change({ majorId: e.target.value })}
              aria-invalid={!!errors.majorId}
              aria-describedby={errors.majorId ? 'majorId-error' : undefined}
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
          {!majors.length && (
            <p>Hiện chưa có chuyên ngành Active để chọn mới.</p>
          )}
          <label className="grid gap-2">
            Năm học
            <select
              value={form.academicYear}
              onChange={(e) => change({ academicYear: e.target.value })}
              aria-invalid={!!errors.academicYear}
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
          <SkillOptionsField
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
            <textarea
              value={form.careerGoal}
              onChange={(e) => change({ careerGoal: e.target.value })}
              aria-invalid={!!errors.careerGoal}
              className="rounded-control border border-line p-3"
              rows={4}
            />
            {fieldError('careerGoal')}
          </label>
        </fieldset>
        <Button type="submit" disabled={saving}>
          {saving ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </Button>
        {message && <p role="status">{message}</p>}
      </form>
      <Link to="/opportunities" className="mt-5 inline-block text-brand">
        Để sau / Xem cơ hội
      </Link>
    </section>
  );
}
