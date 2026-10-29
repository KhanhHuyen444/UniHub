# auth

**Backend auth hiện có trên `main`:** `POST /api/auth/google`, `POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/logout`, helper JWT HS256, `requireAuth` kiểm tra `auth_sessions` và `requireRole` dùng role snapshot đã ký. Nhánh `feat/admin-bootstrap` bổ sung lệnh operator cấp Admin đầu tiên; đây không phải endpoint public. Frontend auth chưa triển khai. Hợp đồng chung nằm tại [auth-api-contract.md](../../../../docs/auth-api-contract.md); schema Prisma và migration `google_sub`/`auth_sessions` có trên `main`.

TV1 làm nền backend auth/RBAC trước; **TV2 tiếp quản cùng module và cơ chế**, hoàn thiện UI/session. Không tạo cơ chế xác thực thứ hai. Chưa gán tên người hoặc deadline.

Chạy local: dùng `backend/.env.example` làm mẫu. Nếu `backend/.env` đã tồn tại, chỉ bổ sung các biến còn thiếu, không ghi đè file. Thay `JWT_SIGNING_SECRET` bằng giá trị ngẫu nhiên ít nhất 32 byte; `GOOGLE_CLIENT_ID` phải là Web client ID đã có; `AUTH_ALLOWED_ORIGINS` phải liệt kê origin chính xác. Cookie refresh có thuộc tính cố định theo contract, không cần biến secret riêng. Sau khi database đã có migration/GRANT auth và cấu hình xong, chạy `npm.cmd run dev:backend` từ gốc repo; endpoint nằm dưới `http://127.0.0.1:3001/api/auth/`.

Test Google verifier/Prisma double: `node --test backend/test/auth-google-login.test.mjs backend/test/auth-middleware.test.mjs`. Test MySQL refresh chỉ chạy khi `TEST_AUTH_DATABASE_URL` trỏ tới MySQL loopback riêng có tên database bắt đầu bằng `unihub_auth_test`; test này kiểm tra rollback, refresh đồng thời, giữ hạn session, role mới và thu hồi logout. Không đặt biến đó trỏ tới database của nhóm.

#### Khởi tạo Admin đầu tiên (PowerShell)

1. Khởi động UniHub và đăng nhập bằng Google như người dùng bình thường. Tài khoản phải tồn tại với role `Student`.
2. Operator lấy đúng Google `sub` đã xác minh từ quy trình vận hành tin cậy, rồi chạy từ gốc repository:

   ```powershell
   npm.cmd run admin:bootstrap
   ```

3. Nhập `google_sub` tại prompt, kiểm tra tài khoản được hiển thị, rồi nhập `PROMOTE` để xác nhận. Mọi câu trả lời khác hủy mà không ghi dữ liệu. Script lấy `DATABASE_URL` từ `backend/.env` nếu có; không in URL, token hoặc secret.
4. Người được cấp quyền refresh phiên hoặc đăng nhập Google lại để nhận access token mới có role `Admin`. JWT hiện tại giữ role đã ký.

Lệnh chỉ hoạt động khi chưa có Admin; transaction khóa user rows và kiểm tra điều kiện lần nữa để hai lần chạy đồng thời không cùng cấp quyền. Không chạy trên database nhóm nếu chưa được nhóm cho phép.

Middleware chỉ được gắn rõ ràng vào route cần bảo vệ; health, readiness và API public hiện tại không yêu cầu JWT. Chỉ backend truy cập MySQL. Theo [quy trình nhóm](../../../../docs/team-workflow.md), [quy ước API](../../../../docs/api-conventions.md) và [mục lục hợp đồng](../../../../docs/api-contracts.md).
