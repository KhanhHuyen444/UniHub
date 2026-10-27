# auth

**Chưa triển khai.** Hợp đồng xác thực và phân quyền đang chờ nhóm review tại [auth-api-contract.md](../../../../docs/auth-api-contract.md).

Leader làm trước nền backend dùng chung cho Google ID token, JWT UniHub và RBAC để Admin cơ hội dùng được. Sau đó **TV2 tiếp quản cùng module**, duy trì API/middleware và hoàn thiện đăng nhập/đăng xuất, hồ sơ, tài khoản. Không tạo cơ chế xác thực thứ hai. Chưa gán tên cá nhân hoặc deadline.

Module dự kiến chứa routes/services cho login, refresh, current user, logout; middleware dùng chung đặt trong `backend/src/middleware/` (`requireAuth`, `requireRole`). Chỉ backend kết nối MySQL. Chưa tạo endpoint hoặc code placeholder; schema identity/session/status còn cần duyệt và migration riêng. Theo [quy trình nhóm](../../../../docs/team-workflow.md), [quy ước API](../../../../docs/api-conventions.md) và [hợp đồng auth](../../../../docs/auth-api-contract.md).
