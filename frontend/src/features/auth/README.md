# Xác thực frontend dùng chung

Frontend auth đang được triển khai trên nhánh `feat/auth-frontend`; backend cung cấp `POST /api/auth/google`, `POST /api/auth/refresh`, `GET /api/auth/me` và `POST /api/auth/logout` trên `main`. Hợp đồng: [auth-api-contract.md](../../../../docs/auth-api-contract.md).

`AuthProvider` khôi phục phiên khi khởi động. Access JWT chỉ ở bộ nhớ trang; refresh secret chỉ nằm trong cookie HttpOnly do backend quản lý. Không dùng localStorage/sessionStorage, không tin role từ GIS và không tạo cơ chế auth thứ hai. `protectedApiRequest` tự gửi Bearer token, dùng chung một lần refresh cho request song song và chỉ retry request bị 401 một lần. Dùng `RequireRole role="Admin"` bọc route Admin; backend vẫn phải kiểm tra quyền.

```tsx
<Route
  path="/admin/module"
  element={
    <RequireRole role="Admin">
      <AdminModulePage />
    </RequireRole>
  }
/>
```

Trong module được bảo vệ, gọi `protectedApiRequest('/api/auth/me')` hoặc API module cần thiết. Không gửi role do giao diện tự chọn; guard chỉ dùng role từ `/api/auth/me` và server vẫn kiểm tra mọi route.

`LoginPage` dùng nút Google Identity Services chính thức, gửi ID token nguyên trạng tới backend rồi đọc hồ sơ qua `/api/auth/me`. Đăng xuất xóa state cục bộ ngay và gọi backend để thu hồi đúng session; nếu máy chủ không xác nhận, LoginPage hiển thị cảnh báo sau điều hướng.

## Chạy local trên Windows

1. Tạo OAuth Web client trong Google Cloud theo cấu hình nhóm; thêm origin `http://127.0.0.1:5173` vào client và backend `AUTH_ALLOWED_ORIGINS`. Dùng cùng client ID ở frontend `VITE_GOOGLE_CLIENT_ID` và backend `GOOGLE_CLIENT_ID`. Client ID là public; không đặt client secret hoặc khóa backend vào frontend.
2. Tại gốc repository, sao chép `frontend/.env.example` thành `frontend/.env` nếu tệp chưa có, rồi thay placeholder `VITE_GOOGLE_CLIENT_ID` bằng client ID đã cấp. Không commit `.env`.
3. Chạy backend/frontend theo README. Mở `http://127.0.0.1:5173/login`; Google sẽ chuyển ID token qua frontend tới backend same-origin `/api`.

Kiểm thử trong nhánh dùng API fetch double và trình duyệt với API/GIS mock để kiểm tra luồng giao diện. Chưa xác minh thông tin OAuth thật hoặc đăng nhập Google production. Admin shell trong `/_dev/ui?area=admin` tiếp tục là preview tĩnh, không giả lập người đăng nhập; khi module sản phẩm dùng `AdminLayout`, tên/email và đăng xuất lấy từ auth context thật.

## Tích hợp Student Profile — PR #36

LoginPage để Auth hoàn tất Google login, sau đó ProfileLoginRedirect đọc GET `/api/users/me/profile` qua client bảo vệ chung. Student thiếu hồ sơ đến `/profile` kể cả khi có returnTo; Student đủ hồ sơ về `/` hoặc safe returnTo. Lỗi kiểm tra hồ sơ hiển thị retry, không tự coi hồ sơ là đủ. Chỉ kiểm tra ở login, không ép Student đã chọn “Để sau” hoàn thiện hồ sơ khi dùng chức năng công khai. Admin không gọi API Profile và giữ routing hiện có. PR giữ markup login nền và GoogleIdentityButton theo HEAD; phần Login UI riêng được bảo toàn ngoài phạm vi PR.

## Giao diện Login và Luồng điều hướng sau đăng nhập (Login Flow)

- `/login` được bọc bằng `LoginLayout` riêng theo thiết kế: header 4 link khám phá (`/`, `/opportunities`, `/roadmaps`, `/forum`), anchor tài khoản `#login-panel` focus form, footer chuẩn `.login-shell`. Class `unihub-login` tự động gắn/gỡ khỏi `body`.
- `LoginPresentation` bố cục hai cột: cột giới thiệu và 3 lợi ích bên trái; panel đăng nhập với logo, slogan, Google GIS thật, thông báo trạng thái và cam kết quyền riêng tư bên phải. Responsive gập một cột khi màn hình ≤ 760px.
- `GoogleIdentityButton` hỗ trợ `width` linh hoạt (270px cho Login card, mặc định 320px) với `ResizeObserver` đo kích thước thực tế, giữ nguyên cơ chế bảo vệ `disabled` và `inert`.
- Chuẩn hóa post-login qua `loginDestination`:
  - Student thiếu Profile → `/profile`.
  - Student đủ Profile → `/` (hoặc safe `returnTo`).
  - Admin → `/admin/dashboard`.
  - Lưu hồ sơ hoặc chọn “Để sau” → `/` (kèm thông báo `profileSaved` nếu lưu thành công).
- Cơ chế an toàn: chống redirect loop (loại trừ `/login`), chặn URL bên ngoài với `safeReturnPath`, xử lý session restoration và refresh 401 tự động.
