# Quản lý dữ liệu UniHub

Chưa có database thực tế, schema Prisma, migration hoặc seed trong scaffold. Health HTTP chạy mà không cần MySQL.

Theo quyết định mới của nhóm, khi triển khai dữ liệu, **nguồn chính duy nhất** là:

- `backend/prisma/schema.prisma`: mô hình Prisma ánh xạ đủ 12 bảng Chương 4.
- `backend/prisma/migrations/`: lịch sử SQL migration do Prisma quản lý, có phần SQL bổ sung để giữ CHECK/ON UPDATE đúng thiết kế.
- `backend/prisma.config.ts`: cấu hình CLI và vị trí schema/migration, chỉ tạo khi làm nhiệm vụ database.

Không tạo bộ SQL/schema cạnh tranh trong database/. Thư mục này hiện giữ hướng dẫn, sau có thể bổ sung tài liệu dữ liệu đã review. TV1 điều phối migration; mỗi TV đề xuất và kiểm tra thay đổi của phần mình. Không đưa dump, tài khoản hoặc dữ liệu cá nhân lên Git.

Vị trí này thay cho đề xuất cũ database/prisma/; phần ánh xạ 12 bảng trong [architecture.md](../docs/architecture.md) vẫn được giữ nguyên. Cách liên kết Google sub/session và các hành vi FK chưa rõ cần nhóm quyết định trước khi triển khai tương ứng.
