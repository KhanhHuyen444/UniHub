# Khu vực Admin

Chưa triển khai route hoặc UI Admin. Một ứng dụng React dùng chung, không tạo ứng dụng Admin riêng.

Khi làm chức năng, chia component/API theo người phụ trách dự kiến:

| Thư mục con dự kiến | Phụ trách | Phạm vi                                              |
| ------------------- | --------- | ---------------------------------------------------- |
| users/              | TV2       | Tài khoản và vai trò                                 |
| opportunities/      | TV1       | Tab thẩm định cơ hội trong /admin/moderation         |
| categories/         | TV3       | Chuyên ngành và kỹ năng                              |
| dashboard/          | TV4       | Dashboard thống kê                                   |
| forum/              | TV5       | Tab kiểm duyệt bài/bình luận trong /admin/moderation |

TV1 phối hợp shell/menu với layouts/ và app/ sau khi có tài liệu hình ảnh Figma. Không gom mọi chức năng vào một file Admin lớn; không giao cả Admin Portal cho một người. Chỉ tạo các thư mục con khi có mã thật. Phân công theo yêu cầu mới nhất; tên người và deadline chưa được gán. Route guard không thay kiểm tra quyền backend.
