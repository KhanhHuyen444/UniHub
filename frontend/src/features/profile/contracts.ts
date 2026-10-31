import { ApiError } from '../../lib/api';
export interface ProfileCategory {
  id: number;
  name: string;
  status: 'Active' | 'Closed';
}
export interface Profile {
  major: ProfileCategory | null;
  academicYear: number | null;
  skills: ProfileCategory[];
  careerGoal: string | null;
}
export interface ProfileResponse {
  profile: Profile;
  isComplete: boolean;
}
export interface ProfileInput {
  majorId: number;
  academicYear: number;
  skillIds: number[];
  careerGoal: string | null;
}
export interface ProfileForm {
  majorId: string;
  academicYear: string;
  skillIds: number[];
  careerGoal: string;
}
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) > 0 && (v as number) <= 2147483647;
function invalid(): never {
  throw new ApiError('Dữ liệu hồ sơ trả về không hợp lệ.', {
    code: 'INVALID_RESPONSE',
    kind: 'response',
  });
}
function category(v: unknown): ProfileCategory {
  if (
    !record(v) ||
    !id(v.id) ||
    typeof v.name !== 'string' ||
    !v.name.trim() ||
    (v.status !== 'Active' && v.status !== 'Closed')
  )
    return invalid();
  return { id: v.id, name: v.name, status: v.status };
}
export function parseProfile(v: unknown): ProfileResponse {
  if (!record(v) || !record(v.profile) || typeof v.isComplete !== 'boolean')
    return invalid();
  const p = v.profile;
  if (
    !(
      p.academicYear === null ||
      (Number.isInteger(p.academicYear) &&
        Number(p.academicYear) >= 1 &&
        Number(p.academicYear) <= 4)
    ) ||
    !Array.isArray(p.skills) ||
    !(p.careerGoal === null || typeof p.careerGoal === 'string')
  )
    return invalid();
  const profile: Profile = {
    major: p.major === null ? null : category(p.major),
    academicYear: p.academicYear as number | null,
    skills: p.skills.map(category),
    careerGoal: p.careerGoal,
  };
  if (
    new Set(profile.skills.map((s) => s.id)).size !== profile.skills.length ||
    (profile.careerGoal && Array.from(profile.careerGoal).length > 200)
  )
    return invalid();
  const complete =
    profile.major !== null &&
    profile.academicYear !== null &&
    profile.skills.length > 0;
  if (complete !== v.isComplete) return invalid();
  return { profile, isComplete: complete };
}
export function toForm(p: Profile): ProfileForm {
  return {
    majorId: p.major ? String(p.major.id) : '',
    academicYear: p.academicYear === null ? '' : String(p.academicYear),
    skillIds: p.skills.map((s) => s.id),
    careerGoal: p.careerGoal ?? '',
  };
}
export function validateForm(form: ProfileForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!/^\d+$/.test(form.majorId) || !id(Number(form.majorId)))
    errors.majorId = 'Vui lòng chọn chuyên ngành.';
  if (!/^[1-4]$/.test(form.academicYear))
    errors.academicYear = 'Chọn năm học từ 1 đến 4.';
  if (
    !form.skillIds.length ||
    !form.skillIds.every(id) ||
    new Set(form.skillIds).size !== form.skillIds.length
  )
    errors.skillIds = 'Chọn ít nhất một kỹ năng hợp lệ.';
  if (Array.from(form.careerGoal.trim()).length > 200)
    errors.careerGoal = 'Mục tiêu nghề nghiệp tối đa 200 ký tự.';
  return errors;
}
export function toInput(form: ProfileForm): ProfileInput {
  return {
    majorId: Number(form.majorId),
    academicYear: Number(form.academicYear),
    skillIds: [...form.skillIds],
    careerGoal: form.careerGoal.trim() || null,
  };
}
