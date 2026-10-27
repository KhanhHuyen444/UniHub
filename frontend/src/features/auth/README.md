# auth

Đăng nhập/đăng xuất Google và trạng thái xác thực; **chưa triển khai**. Đọc [hợp đồng auth](../../../../docs/auth-api-contract.md) trước khi làm UI.

TV2 tiếp quản nền backend auth/RBAC dùng chung do leader làm trước, rồi hoàn thiện UI đăng nhập/đăng xuất tại đây. Dùng cùng API, access-token memory và `frontend/src/lib/api.ts`; không tạo cơ chế xác thực hoặc API client thứ hai. Chưa gán tên người hoặc deadline.

Chỉ thêm component, hook và lời gọi API khi triển khai chức năng; không tạo route giả hoặc dữ liệu cá nhân để giữ chỗ. Đọc [quy trình nhóm](../../../../docs/team-workflow.md).
