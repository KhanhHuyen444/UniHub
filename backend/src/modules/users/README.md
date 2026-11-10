# users

Đã triển khai đầy đủ các chức năng quản lý người dùng:

- **Hồ sơ sinh viên (Student Profile):** `GET /api/users/me/profile` và `PUT /api/users/me/profile` cho phép cập nhật chuyên ngành, năm học, mục tiêu nghề nghiệp và kỹ năng cá nhân (hỗ trợ thuật toán gợi ý cơ hội).
- **Quản trị người dùng & Phân quyền (Admin Users & RBAC):** `GET /api/admin/users` (tìm kiếm, lọc, phân trang) và `PATCH /api/admin/users/:id/role` (nâng quyền Admin, hạ quyền Student).
- **Bảo mật & Tương tranh:** Tích hợp quy tắc bảo vệ Quản trị viên cuối cùng (Last Admin Protection), cơ chế khóa dòng giao dịch (`SELECT ... FOR UPDATE`) để tuần tự hóa hạ quyền đồng thời, và ghi nhận kiểm toán tự động vào bảng `activity_logs`.

Contracts: [profile](../../../../docs/profile-api-contract.md) và [Admin users](../../../../docs/admin-users-api-contract.md). Phụ trách: **Thái Bình** theo [quy trình nhóm](../../../../docs/team-workflow.md).

Thay đổi vai trò có hiệu lực ở lần cấp access token tiếp theo (login/refresh), theo BR-14.5; token còn hạn giữ role snapshot. Test cạnh tranh dùng fixture tuần tự hóa bằng JavaScript, không chứng minh hành vi khóa MySQL thực tế.
