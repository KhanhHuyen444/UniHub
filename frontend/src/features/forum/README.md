# forum

Đã triển khai đầy đủ các tính năng diễn đàn sinh viên:

- `/forum`: danh sách bài viết công khai (`ForumHubPage`), lọc theo topic, phân trang.
- `/forum/:id`: chi tiết bài viết công khai và danh sách bình luận (`ForumPostDetailPage`).
- Đăng bài thảo luận mới dành cho Student đã xác thực (`POST /api/forum/posts`).
- Gửi bình luận thảo luận dành cho Student đã xác thực (`POST /api/forum/posts/:id/comments`).
- Phân hệ kiểm duyệt nội dung diễn đàn dành cho Admin tại `/admin/moderation` (Tab 2: Kiểm duyệt cộng đồng).

Contract: [forum-api-contract.md](../../../../docs/forum-api-contract.md). Phụ trách: **TV5**, cả frontend và backend tương ứng theo [quy trình nhóm](../../../../docs/team-workflow.md).
