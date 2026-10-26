# Khu vực Admin

Chưa triển khai route hoặc UI nghiệp vụ Admin. `AdminLayout` chỉ có trong `/_dev/ui?area=admin`; đây là preview hình thức, không xác thực người dùng hoặc quyền.

Khi làm chức năng, chia component/API theo người phụ trách:

| Thư mục con dự kiến | Phụ trách | Phạm vi                                                |
| ------------------- | --------- | ------------------------------------------------------ |
| `users/`            | TV2       | Tài khoản và vai trò                                   |
| `opportunities/`    | TV1       | Tab thẩm định cơ hội trong `/admin/moderation`         |
| `categories/`       | TV3       | Chuyên ngành và kỹ năng                                |
| `dashboard/`        | TV4       | Dashboard thống kê                                     |
| `forum/`            | TV5       | Tab kiểm duyệt bài/bình luận trong `/admin/moderation` |

TV1 điều phối shell/menu với `layouts/` và route config tại `app/router.tsx`. Không gom mọi chức năng vào một file Admin lớn, không giao cả Admin Portal cho một người, và chỉ tạo thư mục con khi có mã thật. Route guard không thay kiểm tra quyền backend.
