import { useLocation } from 'react-router';

export function ProfileSavedNotice() {
  const { state } = useLocation();
  return state?.profileSaved === true ? (
    <p role="status" className="bg-green-50 px-8 py-3 text-green-800">
      Cập nhật hồ sơ thành công
    </p>
  ) : null;
}
