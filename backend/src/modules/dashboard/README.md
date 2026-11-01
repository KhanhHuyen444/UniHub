# dashboard

Backend Admin Dashboard theo [contract đã duyệt](../../../../docs/dashboard-api-contract.md):

- `GET /api/admin/dashboard/accounts`: count toàn bộ users.
- `GET /api/admin/dashboard/opportunities`: chỉ Thực tập/Việc làm/Học bổng, nhóm Pending/Approved/Rejected, luôn có các giá trị 0; loại bài định hướng.
- `GET /api/admin/dashboard/forum`: posts chưa xóa; comments chưa xóa và parent post chưa xóa.

Shared JWT/session middleware và Admin guard: Guest 401, Student 403. Không nhận query/body; dùng error envelope chung. Mỗi metric có `evaluatedAt` UTC riêng, không cam kết snapshot đồng bộ. Chỉ đọc, không activity log hoặc transaction liên module. Không thêm chart/KPI/frontend.

`backend/test/dashboard.test.mjs` kiểm tra route thật với Prisma double: quyền, exact DTO/count/predicate, zero, query/body (kể cả chunked), lỗi và metric độc lập. Truy vấn cơ hội dùng COUNT/GROUP BY với `utf8mb4_0900_as_cs` tường minh; không tải nội dung cơ hội, không phụ thuộc collation mặc định.

Regression MySQL đã chạy ngày 31/10/2026 trên MySQL 8.4.13 mới hoàn toàn, database mặc định `utf8mb4_0900_as_ci`, áp dụng migrations hiện có. Đã tái hiện query cũ đếm sai biến thể hoa/thường; query mới chỉ tính ba loại chính xác, loại bài định hướng và giữ đủ ba status, kể cả 0. Query chỉ đọc, không tạo activity log. Chạy lại bằng `node backend/test/run-dashboard-mysql.mjs --run-isolated` sau build; runner không nạp `.env`, kiểm tra cổng/datadir/UUID, tắt instance sau test. Không dùng database cá nhân/nhóm, không GRANT/REVOKE hoặc sửa schema/migration. Runtime SELECT grants trên môi trường triển khai, NFR và UI Admin đăng nhập Google thật vẫn cần kiểm tra riêng.

Phụ trách: **TV4**. Phối hợp TV1 về opportunities/app mount, TV2 về users, TV5 về forum predicates; không sửa các module đó.

Router/service nằm trong module này. Tái sử dụng Prisma runtime; cần SELECT trên users/opportunities/forum_posts/comments và auth_sessions. Không đổi schema/migration. Theo [quy trình nhóm](../../../../docs/team-workflow.md) và [quy ước API](../../../../docs/api-conventions.md).
