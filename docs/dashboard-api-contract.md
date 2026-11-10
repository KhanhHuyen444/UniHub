# Hợp đồng API Admin Dashboard

> **Contract: leader đã duyệt. Implementation: ba API metrics và frontend `/admin/dashboard` đã có trên `main` và nhánh tài liệu hiện tại**, qua `backend/src/modules/dashboard/dashboard.routes.ts` và `AdminDashboardPage`. Chỉ trả đúng số liệu Chương 3 UC-12; không thêm KPI/biểu đồ trong hợp đồng API này.

## Quyền và endpoints

Mỗi endpoint yêu cầu access JWT hợp lệ và role Admin qua backend. Guest → 401 UNAUTHORIZED; Student → 403 FORBIDDEN. Không nhận body/query; GET mỗi metric độc lập để lỗi chỉ ảnh hưởng card tương ứng. Mỗi response có evaluatedAt UTC tại thời điểm query; các endpoint không hứa snapshot đồng bộ với nhau.

| Method/path                            | Data predicate                                                                                                                                          | 200 response                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| GET /api/admin/dashboard/accounts      | COUNT mọi users rows.                                                                                                                                   | {"totalAccounts":28,"evaluatedAt":"2026-10-28T00:00:00Z"}                                  |
| GET /api/admin/dashboard/opportunities | COUNT opportunities thuộc Thực tập/Việc làm/Học bổng, theo đúng các status Pending, Approved, Rejected; bài định hướng bị loại. Các count 0 vẫn có mặt. | {"byStatus":{"Pending":2,"Approved":12,"Rejected":1},"evaluatedAt":"2026-10-28T00:00:00Z"} |
| GET /api/admin/dashboard/forum         | posts count chỉ forum_posts.is_deleted=false; comments count is_deleted=false và parent post còn public (is_deleted=false).                             | {"posts":5,"comments":14,"evaluatedAt":"2026-10-28T00:00:00Z"}                             |

Ví dụ là dữ liệu hư cấu. Response không chứa thông tin người dùng, nội dung bài
đăng/bình luận hoặc dữ liệu định danh cá nhân tài khoản (PII). Mỗi endpoint chỉ
đọc dữ liệu, không ghi activity log và không dùng giao dịch xuyên module.
Frontend gửi đồng thời cả ba request; mỗi thẻ tự quản lý trạng thái tải/lỗi/thử
lại. Metric lỗi không bao giờ được biểu diễn thành 0; các thẻ thành công vẫn có
thể hiển thị.

Lỗi theo từng endpoint: Guest nhận 401 UNAUTHORIZED; Student nhận 403 FORBIDDEN;
DB không khả dụng nhận 503 SERVICE_UNAVAILABLE; lỗi ngoài dự kiến nhận 500
INTERNAL_ERROR. Body lỗi dùng envelope chung, không trả số liệu một phần hoặc
chi tiết database. Không hỗ trợ tham số; thêm query bất kỳ sẽ nhận 400
INVALID_QUERY.

Nguồn dữ liệu: users; opportunities; forum_posts/comments. Số đếm lấy từ DB tại
thời điểm đánh giá, không phải snapshot đồng bộ. DB constraint không thực thi các
điều kiện lọc này; backend phải làm việc đó trong query. Ma trận test: ma trận
phân quyền; số tài khoản; cả ba loại/trạng thái cơ hội, bao gồm trạng thái có
số đếm bằng 0 và loại trừ bài định hướng; ẩn bài đăng/bình luận đã xóa và bình
luận thuộc bài đã xóa; từng endpoint lỗi độc lập và không hiển thị lỗi thành 0;
không ghi dữ liệu/log; không thêm metric. Mục tiêu NFR từ UC-12 (Dashboard ≤2s,
API aggregation ≤500ms trong tải bình thường) vẫn là yêu cầu hiệu năng cần đo,
không tự động được đáp ứng chỉ vì contract đã duyệt.
