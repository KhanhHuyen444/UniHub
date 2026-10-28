# auth

**Nền access token đã triển khai một phần:** helper JWT HS256, `requireAuth` kiểm tra `auth_sessions` và `requireRole` dùng role snapshot đã ký. Google login, refresh/logout, endpoint hồ sơ và frontend chưa triển khai. Hợp đồng chung nằm tại [auth-api-contract.md](../../../../docs/auth-api-contract.md); schema Prisma và migration `google_sub`/`auth_sessions` có trên `main`.

TV1 làm nền backend auth/RBAC trước; **TV2 tiếp quản cùng module và cơ chế**, hoàn thiện UI/session. Không tạo cơ chế xác thực thứ hai. Chưa gán tên người hoặc deadline.

Middleware chỉ được gắn rõ ràng vào route cần bảo vệ; health, readiness và API public hiện tại không yêu cầu JWT. Chỉ backend truy cập MySQL. Theo [quy trình nhóm](../../../../docs/team-workflow.md), [quy ước API](../../../../docs/api-conventions.md) và [mục lục hợp đồng](../../../../docs/api-contracts.md).
