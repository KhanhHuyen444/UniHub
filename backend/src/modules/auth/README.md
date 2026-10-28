# auth

**Chưa triển khai.** Hợp đồng chung nằm tại [auth-api-contract.md](../../../../docs/auth-api-contract.md); role timing/Google ID token/session decisions đã được giữ, còn endpoint paths/security implementation cần review. Chương 4 PDF mới mô tả google_sub/auth_sessions nhưng schema/migrations trên main chưa có.

TV1 làm nền backend auth/RBAC trước; **TV2 tiếp quản cùng module và cơ chế**, hoàn thiện UI/session. Không tạo cơ chế xác thực thứ hai. Chưa gán tên người hoặc deadline.

Khi bắt đầu, giải quyết schema mismatch qua PR riêng trước khi kết nối DB auth; chưa tạo code rỗng hoặc endpoint giả. Chỉ backend truy cập MySQL. Theo [quy trình nhóm](../../../../docs/team-workflow.md), [quy ước API](../../../../docs/api-conventions.md) và [mục lục hợp đồng](../../../../docs/api-contracts.md).
