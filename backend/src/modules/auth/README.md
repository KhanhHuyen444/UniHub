# auth

**Backend auth đã triển khai một phần:** `POST /api/auth/google`, helper JWT HS256, `requireAuth` kiểm tra `auth_sessions` và `requireRole` dùng role snapshot đã ký. Refresh/logout, endpoint hồ sơ và frontend chưa triển khai. Hợp đồng chung nằm tại [auth-api-contract.md](../../../../docs/auth-api-contract.md); schema Prisma và migration `google_sub`/`auth_sessions` có trên `main`.

TV1 làm nền backend auth/RBAC trước; **TV2 tiếp quản cùng module và cơ chế**, hoàn thiện UI/session. Không tạo cơ chế xác thực thứ hai. Chưa gán tên người hoặc deadline.

Chạy local: dùng `backend/.env.example` làm mẫu. Nếu `backend/.env` đã tồn tại, chỉ bổ sung các biến còn thiếu, không ghi đè file. Thay `JWT_SIGNING_SECRET` bằng giá trị ngẫu nhiên ít nhất 32 byte; `GOOGLE_CLIENT_ID` phải là Web client ID đã có; `AUTH_ALLOWED_ORIGINS` phải liệt kê origin chính xác. Cookie refresh có thuộc tính cố định theo contract, không cần biến secret riêng. Sau khi database đã có migration/GRANT auth và cấu hình xong, chạy `npm.cmd run dev:backend` từ gốc repo; API ở `http://127.0.0.1:3001/api/auth/google`.

Middleware chỉ được gắn rõ ràng vào route cần bảo vệ; health, readiness và API public hiện tại không yêu cầu JWT. Chỉ backend truy cập MySQL. Theo [quy trình nhóm](../../../../docs/team-workflow.md), [quy ước API](../../../../docs/api-conventions.md) và [mục lục hợp đồng](../../../../docs/api-contracts.md).
