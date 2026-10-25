# Migration MySQL của UniHub

Ngày: **25/10/2026**. Initial migration được tạo trên nhánh `feat/initial-migration` từ `main` tại `d10ab25`. Mục đích là chuyển schema đã review thành một lịch sử migration dùng chung cho cả nhóm. File migration được commit; các lần test database bên dưới chỉ dùng MySQL 8.4 dùng một lần trong môi trường Codex. **Không có database trên máy người dùng nào được mở hoặc thay đổi.**

## Quyết định đã xác nhận

- Charset `utf8mb4`; collation mặc định `utf8mb4_0900_as_ci` cho schema và các bảng. So sánh không phân biệt hoa/thường, nhưng có phân biệt dấu. UNIQUE email xem chữ hoa/thường là cùng một email; backend vẫn phải chuẩn hóa email trước khi lưu. UNIQUE `(type, name)` không cho tên khác nhau chỉ bởi hoa/thường, nhưng cho phép khác dấu.
- Những CHECK so sánh mã/trạng thái dùng `COLLATE utf8mb4_0900_as_cs` trên cột để bắt buộc đúng cả dấu và hoa/thường. Ví dụ `student` không thỏa CHECK của `Student`. Các CHECK năm học/số nguyên không cần collation.
- Lưu thời gian theo UTC, giữ nguyên `DATETIME(0)`; request/response API dùng ISO 8601 có timezone, ưu tiên UTC (`Z`); giao diện hiển thị `Asia/Ho_Chi_Minh`. DATETIME không lưu thông tin timezone. `CURRENT_TIMESTAMP` và `ON UPDATE CURRENT_TIMESTAMP` lấy giờ theo session MySQL, vì vậy từng session ứng dụng và migration phải chạy `SET time_zone = '+00:00'`. Initial migration đặt timezone cho session đang thi hành.
- Quản trị viên database tạo schema và tài khoản. Tài khoản migration riêng có ALL PRIVILEGES chỉ trên database UniHub đang di trú, không có quyền ở mức máy chủ và không được đưa vào backend runtime. Tài khoản ứng dụng là tài khoản riêng, cấp quyền từng bảng bên dưới. Chưa có credentials thật.

## Initial migration tạo gì

`backend/prisma/migrations/20261025000000_initial_schema/migration.sql` bắt nguồn từ SQL diff `--from-empty --to-schema` của Prisma 7.10.1. Phần Prisma sinh tạo 12 bảng nghiệp vụ, 81 cột, 12 PK, 16 FK, 2 UNIQUE, native types, NULL và defaults theo schema. Sau đó SQL migration được bổ sung:

- 13 named CHECK trong Chương 4. Không thêm CHECK cho các miền `opportunity_type` và `forum_posts.topic` mà tài liệu chỉ yêu cầu backend xác thực.
- `ON DELETE CASCADE` duy nhất ở `notifications.event_id`; 15 FK còn lại `ON DELETE RESTRICT`; cả 16 `ON UPDATE RESTRICT`.
- `ON UPDATE CURRENT_TIMESTAMP(0)` cho `users.updated_at` và `events.updated_at`.
- Charset/collation và session timezone/connection charset đã xác nhận.

Không có enum, trigger, bảng identity/session, tài khoản, seed data hoặc chức năng nghiệp vụ. Prisma tạo thêm bảng kỹ thuật `_prisma_migrations` khi áp dụng migration; đây không phải bảng nghiệp vụ thứ 13.

## Tài khoản và quyền

Tạo schema/tài khoản bằng quản trị viên có quyền phù hợp trên MySQL. SQL dưới đây chỉ là mẫu; thay tên schema, user, host và mật khẩu bằng giá trị cục bộ, không commit giá trị đã thay vào Git:

```sql
CREATE DATABASE unihub_dev
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;

CREATE USER 'unihub_migrator'@'localhost' IDENTIFIED BY '<migration-secret>';
GRANT ALL PRIVILEGES ON unihub_dev.* TO 'unihub_migrator'@'localhost';

CREATE USER 'unihub_app'@'localhost' IDENTIFIED BY '<runtime-secret>';
```

ALL PRIVILEGES ở đây chỉ gắn với `unihub_dev.*` cho người vận hành chạy migration. Không cấp quyền `*.*`, không dùng tài khoản quản trị để chạy app và không bật `WITH GRANT OPTION`. Prisma migration có thể tạo/thay bảng và ghi bảng `_prisma_migrations`, nên credentials migration phải tách khỏi tiến trình backend.

Runtime cấp SELECT trên từng bảng và ghi theo nghiệp vụ. Các lệnh là mẫu cho đúng bảng và quyền; không thay thành quyền rộng `unihub_dev.*` vì cách đó sẽ cấp UPDATE/DELETE trên `activity_logs`:

```sql
GRANT SELECT, INSERT, UPDATE ON unihub_dev.users TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_dev.categories TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_dev.opportunities TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON unihub_dev.events TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_dev.forum_posts TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_dev.comments TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT ON unihub_dev.activity_logs TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_dev.notifications TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_dev.user_skills TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_dev.opportunity_majors TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_dev.opportunity_skills TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_dev.opportunity_years TO 'unihub_app'@'localhost';
```

Phân quyền database chỉ là lớp bảo vệ cuối. Backend vẫn kiểm tra Student/Admin, ownership, ai được thay đổi bản ghi, lý do kiểm duyệt và transaction. Các quyền phải được xem lại khi use case/API triển khai có thêm thao tác.

## Cấu hình cục bộ và ưu tiên biến

Tại gốc repo, tạo mỗi file nếu nó chưa tồn tại; không ghi đè cấu hình cá nhân:

```powershell
if (-not (Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
if (-not (Test-Path .\backend\.env.migration)) { Copy-Item .\backend\.env.migration.example .\backend\.env.migration }
```

`backend/.env` dành cho `DATABASE_URL` tài khoản ứng dụng về sau. `backend/.env.migration` chỉ dành cho `MIGRATION_DATABASE_URL` của lệnh migrate. Cả hai `.env` thật đều bị ignore. Mẫu chứa password giả để minh họa cú pháp; phải thay cục bộ, không dùng nguyên mẫu để kết nối database.

Lệnh migrate chạy bằng Node `--env-file-if-exists=.env.migration` trong workspace backend. Biến môi trường sẵn có ở shell/CI được Node ưu tiên hơn biến cùng tên trong file; nếu không được đặt ngoài shell thì Node nạp file migration mẫu đã người dùng điền. Prisma config chỉ đọc `MIGRATION_DATABASE_URL`, không tự nạp `.env` và không dùng fallback sang mật khẩu runtime. Mọi lệnh dưới đây chạy tại **gốc UniHub**; npm chuyển sang thư mục backend của workspace.

```powershell
npm.cmd run db:migrate:status
npm.cmd run db:migrate:deploy
npm.cmd run db:migrate:status
```

`status` chỉ kiểm tra lịch sử database được chỉ bởi `MIGRATION_DATABASE_URL`. `deploy` áp dụng các migration đã commit còn thiếu; không tạo migration mới và không reset database. Trong quyền đã chốt, migrator chỉ có grants trên schema đang tồn tại nên quản trị viên phải tạo database/tài khoản trước. Prisma CLI có thể thử tạo database khi thiếu nếu caller có quyền cấp máy chủ; tài khoản migration trong hướng dẫn không có quyền đó. Hãy xác nhận URL trỏ tới database phát triển riêng của bạn trước khi chạy `deploy`.

## Quy trình nhóm

Nhóm dùng **migration initial duy nhất** này để thiết lập schema ban đầu; thành viên không tự tạo migration ban đầu thứ hai. Mỗi người checkout cùng commit và chạy migration vào database phát triển riêng của mình.

Không chỉnh migration sau khi đã chia sẻ/áp dụng. Mọi thay đổi tiếp theo cần thư mục migration mới, được review rồi mới commit. `migrate deploy` lần hai sẽ báo không còn migration chờ áp dụng; không chạy `migrate dev`, `db push`, `migrate reset`, seed hoặc SQL diff với database người dùng cho việc này.

## Kiểm thử MySQL dùng một lần

Đã tạo một container không gắn volume và schema `unihub_migration_test`, không chứa dữ liệu người dùng. Container dùng image chính thức `mysql:8.4`, server thực tế **8.4.13**, timezone UTC, `utf8mb4_0900_as_ci`; tài khoản migration/app là credentials ngẫu nhiên chỉ dùng trong container. Sau test, toàn bộ container và credentials sẽ bị xóa. Môi trường này tách khỏi database/máy của nhóm.

- Prisma `migrate deploy` lần đầu đạt bằng tài khoản migration có quyền trên đúng schema; `migrate status` báo schema up to date; `migrate deploy` lần hai báo không còn migration chờ áp dụng.
- Metadata MySQL xác nhận 12 bảng nghiệp vụ, 81 cột, 12 PK, 16 FK, 2 UNIQUE, 13 CHECK và `_prisma_migrations` riêng. 12 bảng dùng đúng collation; hai `updated_at` có thuộc tính ON UPDATE. Hành vi FK là một CASCADE / 15 RESTRICT cho DELETE và 16 RESTRICT cho UPDATE.
- INSERT tiếng Việt, `academic_year = NULL`, `work_format = NULL` và bài định hướng không publisher thành công. Mỗi một trong 13 CHECK bị thử với giá trị sai và đều bị từ chối; email/tên trùng hoa-thường bị UNIQUE từ chối, tên khác dấu được phân biệt. PK ghép trùng, FK không tồn tại, DELETE/UPDATE RESTRICT đều bị từ chối; xóa event cascade đúng notification.
- Cập nhật trường thường làm `users.updated_at` và `events.updated_at` tăng ít nhất một giây ở độ chính xác DATETIME(0). Transaction DML rollback không để lại dòng. Session tài khoản thử thiết lập timezone UTC thành công.
- Runtime user được phép đọc và ghi theo bảng, xóa event/association; UPDATE/DELETE `activity_logs` và CREATE TABLE bị từ chối. Migration user có ALL PRIVILEGES đúng một schema; không có CREATE DATABASE ở mức máy chủ.
- Prisma migrate diff từ database về Prisma schema trả SQL diff rỗng. Điều đó **không phát hiện** CHECK, collation hoặc ON UPDATE do các đặc điểm này không được schema Prisma biểu diễn; đây là giới hạn mong đợi, không phải bằng chứng đã drift-free toàn bộ MySQL metadata. SQL initial migration đã kiểm tra riêng bằng metadata và hành vi phía trên.
- Prisma validate/generate, typecheck, build, 10 test (7 HTTP + 3 CSS), format check và audit được chạy lại sau khi cập nhật scripts/docs. Audit không có lỗ hổng. Giữ nguyên Tailwind 3.4.19/Prisma 7.10.1 và override parser đã chốt; `npm ls` còn cảnh báo đã biết về khoảng `^6` so với parser 7.1.6, xem [dependency-security.md](dependency-security.md).

Kiểm tra này xác nhận migration trên đúng MySQL 8.4.13 trong Codex/Linux. Nó không chứng minh MySQL phòng học, host/collation khác hoặc máy Windows của thành viên đã sẵn sàng. Adapter Prisma runtime chưa được thêm; mỗi kết nối ứng dụng sau này phải thiết lập session timezone UTC khi khởi tạo pool.

MySQL DDL có thể implicit commit; nếu một migration lỗi giữa chừng không giả định `ROLLBACK` sẽ hoàn tác CREATE/ALTER. Trên database dùng một lần, lưu lỗi, kiểm tra `_prisma_migrations`/cấu trúc còn lại, bỏ toàn bộ container test và dựng container/database test mới rồi chạy lại. Không chạy RESET/DROP hướng dẫn này trên database có dữ liệu.

Prisma schema không biểu diễn CHECK, collation mặc định bảng hay `ON UPDATE CURRENT_TIMESTAMP`. Vì thế `migrate diff`/drift check không phải kiểm toán đầy đủ SQL tùy chỉnh; có thể coi khác biệt chỉ nằm ở các phần cố ý này là giới hạn biểu diễn. Không xóa ràng buộc SQL để làm cho diff sạch; review mọi thay đổi schema mới cùng migration SQL.

## Tài liệu chính thức

- [Prisma ORM v7: customize migrations](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/prisma-migrate/workflows/customizing-migrations.mdx) và [CLI reference](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/reference/prisma-cli-reference.mdx) cho `migrate diff`, `migrate status`, `migrate deploy`.
- [Prisma MySQL connector v7](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/core-concepts/supported-databases/mysql.mdx).
- [MySQL 8.4 collation names](https://dev.mysql.com/doc/refman/8.4/en/charset-collation-names.html), [CHECK constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html), [date/time types](https://dev.mysql.com/doc/refman/8.4/en/datetime.html) và [GRANT](https://dev.mysql.com/doc/refman/8.4/en/grant.html). Server 8.4.13 dùng trong test xác nhận collation/runtime SQL thực tế.
