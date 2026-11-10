# Frontend Admin

Admin dùng auth/RBAC và `AdminLayout` chung. `RequireRole` hỗ trợ điều hướng; backend vẫn kiểm tra quyền thực sự. Guest đi tới login với returnTo an toàn; Student bị chặn khỏi trang Admin.

## Bốn trang quản trị

- `/admin/dashboard`: KPI, phân bố trạng thái cơ hội, tương tác thảo luận; refresh và lỗi theo từng API.
- `/admin/moderation`: **Kiểm duyệt nội dung**, gồm tab **Tin chờ thẩm định** (`?tab=opportunities`, UC-10) và **Giám sát cộng đồng** (`?tab=community`, UC-11). Tab được giữ theo URL khi reload/back/forward.
- `/admin/categories`: quản lý danh mục Major/Skill.
- `/admin/users`: quản lý tài khoản và phân quyền theo API hiện có.

Route `/admin/opportunities` và chi tiết cũ được giữ để chuyển hướng tương thích; không còn là mục sidebar riêng. Chi tiết moderation dùng `/admin/moderation/:id`.

## Kiểm duyệt

Tab cơ hội tải hàng chờ Pending và chi tiết, duyệt có/không Verified, từ chối với lý do bắt buộc và xác nhận thao tác. DTO giữ publisher nullable và loại Bài viết định hướng khi API trả về; không tự lọc làm sai total/phân trang.

Tab cộng đồng tải bài đăng/bình luận, cho xem ngữ cảnh và gỡ nội dung vi phạm với lý do. Backend điều phối soft delete, Activity Log và Violation Notification trong transaction. Chuyển tab không tự ghi dữ liệu.

Các trang có loading/error/empty và xử lý lỗi API. Implementation không đồng nghĩa đã kiểm chứng Google login, responsive hoặc MySQL trên mọi máy. Xem [hướng dẫn local](../../../../README.md), [contract cơ hội](../../../../docs/admin-opportunities-api-contract.md) và [contract diễn đàn](../../../../docs/forum-api-contract.md).

## Phối hợp review

Khánh Huyền sở hữu thẩm định cơ hội và phối hợp route/moderation shell; Tường Vy sở hữu giám sát cộng đồng; Thái Bình quản lý tài khoản; Bảo Quyên danh mục; Ngọc Tuyền dashboard. Thay đổi mô tả này cập nhật trạng thái tích hợp, không sửa route, API, layout hay quyền.
