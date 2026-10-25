# Quản lý dữ liệu UniHub

Đã có [schema Prisma](../backend/prisma/schema.prisma), [cấu hình CLI](../backend/prisma.config.ts) và Prisma runtime dùng chung. `GET /api/health` không cần MySQL; `GET /api/ready` yêu cầu `DATABASE_URL` và truy vấn MySQL. Không có database của thành viên được quản lý từ repository này.

**Nguồn chính duy nhất** là:

- `backend/prisma/schema.prisma`: mô hình Prisma ánh xạ đủ 12 bảng Chương 4.
- `backend/prisma/migrations/`: nguồn lịch sử migration duy nhất; initial migration đã merge PR #4. Runtime task không sửa file migration.
- `backend/src/lib/prisma.ts`: Prisma Client singleton; chỉ đọc `DATABASE_URL`, không dùng URL migration dự phòng.
- `backend/prisma.config.ts`: Prisma CLI 7 đọc URL riêng `MIGRATION_DATABASE_URL`; migration tách khỏi runtime.

Không tạo bộ SQL/schema cạnh tranh trong database/. Thư mục này hiện giữ hướng dẫn, sau có thể bổ sung tài liệu dữ liệu đã review. TV1 điều phối migration; mỗi TV đề xuất và kiểm tra thay đổi của phần mình. Không đưa dump, tài khoản hoặc dữ liệu cá nhân lên Git.

Đọc [database-schema.md](../docs/database-schema.md) để xem kiểm đếm schema, [database-migrations.md](../docs/database-migrations.md) để xem migration/GRANT và [database-runtime.md](../docs/database-runtime.md) để cấu hình tài khoản runtime, UTC, readiness, lệnh Windows và kiểm tra thực tế. Không tạo bộ SQL/schema cạnh tranh trong database/. Google sub/session vẫn là vấn đề cho nhiệm vụ xác thực, không tự thêm bảng/cột vào schema hiện tại.
