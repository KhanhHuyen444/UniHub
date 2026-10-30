# Review PR #35 — 31/10/2026

Head trước sửa: `d6d8124`, base `origin/main=df6a277`. Nhánh đã chứa main mới nhất; không merge các PR khác hoặc thay route/auth/UI card. #23 đã merge và không chỉnh sửa.

Sửa `getOpportunityMetric`: COUNT/GROUP BY trong MySQL, lọc `opportunity_type COLLATE utf8mb4_0900_as_cs` với đúng Thực tập/Việc làm/Học bổng, lọc trạng thái chính xác. Không tải từng opportunity/description. Response vẫn đủ Pending/Approved/Rejected, mọi count 0 có mặt. Không thay schema, migration, quyền SQL, auth và cách các card tải/lỗi/thử lại độc lập.

HTTP unit: 5 ca route/service với Prisma/auth doubles đạt. MySQL thật: 1 ca regression đạt trên instance MySQL 8.4.13 mới, port/datadir/UUID kiểm chứng, migrations hiện có. Test tái hiện groupBy cũ đếm sai case, thêm ba loại hợp lệ ở cả ba trạng thái, 10 loại sai/bài định hướng ở cả ba trạng thái, kiểm tra kết quả 3/4/3 và trường hợp 3/0/0. Service không thay dữ liệu hoặc logs. Runner guard buộc instance riêng; không nạp `.env` hay dùng database cá nhân/nhóm. Đây là kiểm tra SQL thật, không phải UI Google-auth integration.

Kiểm tra conflict bằng `git merge-tree --write-tree` (không đổi nhánh/main):

- #33 + #35 còn conflict `frontend/src/app/router.tsx`: khi tích hợp cần giữ imports/route `/calendar` của Student và `/admin/dashboard` của Admin, cùng auth guards và toàn bộ Opportunities/Guidance/router hiện có. Chưa có conflict với main, nên không kéo Calendar vào PR Dashboard.
- #34 + #35 còn conflict `backend/src/app.ts`: khi tích hợp giữ imports/dependency/mount Notifications và Dashboard đồng thời với auth, Events, Guidance, Recommendations, Categories, Opportunities và Admin Opportunities. Chưa có conflict với main, nên không kéo Notifications vào PR Dashboard.

Không có checkout đã tích hợp bốn PR; chưa tuyên bố chuỗi xuyên PR đạt. UI Admin với Google thật, ảnh đối chiếu thiết kế cùng viewport và NFR chưa được xác minh tại thời điểm sửa này. Test role/error độc lập hiện tại dùng doubles, được phân biệt với MySQL service test thật.
