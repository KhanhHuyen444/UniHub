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
