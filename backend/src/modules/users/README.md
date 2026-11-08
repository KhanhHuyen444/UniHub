# users

Đã triển khai đầy đủ các chức năng quản lý người dùng:

- **Hồ sơ sinh viên (Student Profile):** `GET /api/users/profile` và `PUT /api/users/profile` cho phép cập nhật chuyên ngành, năm học, mục tiêu nghề nghiệp và kỹ năng cá nhân (hỗ trợ thuật toán gợi ý cơ hội).
- **Quản trị người dùng & Phân quyền (Admin Users & RBAC):** `GET /api/admin/users` (tìm kiếm, lọc, phân trang) và `PATCH /api/admin/users/:id/role` (nâng quyền Admin, hạ quyền Student).
- **Bảo mật & Tương tranh:** Tích hợp quy tắc bảo vệ Quản trị viên cuối cùng (Last Admin Protection), cơ chế khóa dòng giao dịch (`SELECT ... FOR UPDATE`) chống Race Condition khi hạ quyền đồng thời, và ghi nhận kiểm toán tự động vào bảng `activity_logs`.

Contracts: [profile](../../../../docs/profile-api-contract.md) và [Admin users](../../../../docs/admin-users-api-contract.md). Phụ trách: **TV2** theo [quy trình nhóm](../../../../docs/team-workflow.md).
