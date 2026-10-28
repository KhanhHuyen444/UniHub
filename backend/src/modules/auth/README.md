# auth

**Backend auth hiện có:** `POST /api/auth/google`, `POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/logout`, helper JWT HS256, `requireAuth` kiểm tra `auth_sessions` và `requireRole` dùng role snapshot đã ký. Frontend và seed Admin chưa triển khai. Hợp đồng chung nằm tại [auth-api-contract.md](../../../../docs/auth-api-contract.md); schema Prisma và migration `google_sub`/`auth_sessions` có trên `main`.

TV1 làm nền backend auth/RBAC trước; **TV2 tiếp quản cùng module và cơ chế**, hoàn thiện UI/session. Không tạo cơ chế xác thực thứ hai. Chưa gán tên người hoặc deadline.

Chạy local: dùng `backend/.env.example` làm mẫu. Nếu `backend/.env` đã tồn tại, chỉ bổ sung các biến còn thiếu, không ghi đè file. Thay `JWT_SIGNING_SECRET` bằng giá trị ngẫu nhiên ít nhất 32 byte; `GOOGLE_CLIENT_ID` phải là Web client ID đã có; `AUTH_ALLOWED_ORIGINS` phải liệt kê origin chính xác. Cookie refresh có thuộc tính cố định theo contract, không cần biến secret riêng. Sau khi database đã có migration/GRANT auth và cấu hình xong, chạy `npm.cmd run dev:backend` từ gốc repo; endpoint nằm dưới `http://127.0.0.1:3001/api/auth/`.

Test Google verifier/Prisma double: `node --test backend/test/auth-google-login.test.mjs backend/test/auth-middleware.test.mjs`. Test MySQL refresh chỉ chạy khi `TEST_AUTH_DATABASE_URL` trỏ tới MySQL loopback riêng có tên database bắt đầu bằng `unihub_auth_test`; test này kiểm tra rollback, refresh đồng thời, giữ hạn session, role mới và thu hồi logout. Không đặt biến đó trỏ tới database của nhóm.

Middleware chỉ được gắn rõ ràng vào route cần bảo vệ; health, readiness và API public hiện tại không yêu cầu JWT. Chỉ backend truy cập MySQL. Theo [quy trình nhóm](../../../../docs/team-workflow.md), [quy ước API](../../../../docs/api-conventions.md) và [mục lục hợp đồng](../../../../docs/api-contracts.md).
