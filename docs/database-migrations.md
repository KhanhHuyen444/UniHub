# Migration MySQL của UniHub

Initial migration: **25/10/2026**, đã merge vào `main` qua PR #4 tại `d7c2cefc79754728a6731498a33f4d3ebfe40c48`. Migration deadline được thêm riêng ngày **26/10/2026** trên nhánh `feat/opportunity-deadline-metadata`, chờ review/merge. Không sửa hoặc tạo lại migration dùng chung đã áp dụng. Kiểm thử trong tài liệu chỉ dùng MySQL 8.4 tạm ở Codex. **Không có database trên máy thành viên nào được mở hoặc thay đổi.**

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

## Migration metadata deadline đã được duyệt

`backend/prisma/migrations/20261026150000_add_opportunity_deadline_metadata/migration.sql` là migration mới; migration initial ở `20261025000000_initial_schema` giữ nguyên byte-for-byte. Migration chỉ thay đổi bảng `opportunities`:

| Thay đổi                                   | Kiểu / constraint  | Ý nghĩa                                                                                                                                                                                                                                            |
| ------------------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thêm `deadline_source_date`                | `DATE NULL`        | Ngày nguồn cho deadline date-only; không suy ra từ `deadline`.                                                                                                                                                                                     |
| Thêm `deadline_source_timezone`            | `VARCHAR(64) NULL` | Tên IANA hoặc offset nguồn cho deadline có giờ; backend xác thực giá trị.                                                                                                                                                                          |
| Thêm `chk_opportunities_deadline_metadata` | CHECK              | Không cho metadata khi `deadline` NULL; không cho cả hai metadata cùng có giá trị. Cho phép date-only (date có, timezone NULL), datetime (date NULL, timezone có), no-deadline (cả ba NULL) và legacy unknown (deadline có, metadata cả hai NULL). |

Prisma `Opportunity` khai báo `deadline_source_date DateTime? @db.Date` và `deadline_source_timezone String? @db.VarChar(64)`. Schema Prisma không biểu diễn CHECK nên migration bổ sung bằng SQL. CHECK này chỉ kiểm tra tổ hợp cột; không kiểm tra tên timezone, không tính cutoff date-only và không xác minh instant có khớp nguồn. Backend sau này phải xác thực timezone hợp lệ, đổi instant nguồn sang UTC đúng cách và tính cutoff date-only là 00:00 ngày kế tiếp `Asia/Ho_Chi_Minh`.

Migration chỉ thêm hai cột nullable và constraint; **không có UPDATE dữ liệu**. Vì vậy mọi deadline cũ giữ nguyên giá trị và nhận metadata NULL. Có deadline + hai metadata NULL nghĩa là unknown, không được phỏng đoán từ giờ timestamp. Fresh database chạy initial rồi migration metadata; database đã có initial migration và dữ liệu chỉ chạy migration mới. Không áp dụng migration này vào database của nhóm trong nhiệm vụ chuẩn bị.

### Nội dung cần cập nhật trong Chương 4

§4.3.2.3 cần được cập nhật để liệt kê hai cột mới trong `opportunities`, kiểu và NULLability; định nghĩa chính xác ý nghĩa date-only cutoff và datetime instant/timezone; ghi các tổ hợp metadata hợp lệ cùng legacy unknown; nêu CHECK chỉ bảo đảm tính nhất quán cấu trúc và backend chịu trách nhiệm kiểm tra timezone/cutoff. **PDF Chương 4 chưa được sửa trong nhiệm vụ này.**

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
GRANT SELECT, INSERT, UPDATE, DELETE ON unihub_dev.notifications TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_dev.user_skills TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_dev.opportunity_majors TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_dev.opportunity_skills TO 'unihub_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_dev.opportunity_years TO 'unihub_app'@'localhost';
```

Quyền `DELETE` trên `notifications` phục vụ luồng backend xóa Reminder cũ khi thay đổi `due_date`/`remind_before`, cùng transaction reset `events.reminded_at`. Grant này không cấp quyền xóa `events`. Backend vẫn phải kiểm tra quyền sở hữu và điều kiện nghiệp vụ trước khi thực hiện hai thay đổi nguyên tử.

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

### Áp dụng metadata migration trên Windows sau khi PR được review và merge

Chỉ chạy bước deploy sau khi PR đã merge. Mở PowerShell tại gốc repository, giữ an toàn mọi thay đổi cục bộ và dùng **database phát triển riêng của bạn**, không dùng database dùng chung của nhóm:

```powershell
git status
git fetch origin
git switch main
git pull --ff-only origin main
```

Nếu đây là lần clone mới hoặc `package-lock.json` đổi, chạy `npm.cmd ci`. Không cần dependency mới cho migration này. Tạo mẫu cấu hình cục bộ nếu chưa có, rồi nhập `MIGRATION_DATABASE_URL` của database phát triển của chính bạn vào `backend/.env.migration`; không ghi đè file có sẵn hoặc commit file thật:

```powershell
if (-not (Test-Path .\backend\.env.migration)) { Copy-Item .\backend\.env.migration.example .\backend\.env.migration }
notepad .\backend\.env.migration
npm.cmd run db:migrate:status
```

Xác nhận URL trỏ đúng database cá nhân và status cho thấy migration chờ áp dụng, sau đó chạy các scripts hiện có:

```powershell
npm.cmd run db:migrate:deploy
npm.cmd run db:migrate:status
```

Database trống sẽ nhận initial schema rồi metadata migration; database đã initial sẽ chỉ nhận migration mới. Không chạy `migrate dev`, `db push`, reset hoặc seed. Sau khi deploy, bản ghi cũ giữ `deadline`, metadata để NULL và API tương lai phải trả unknown đến khi nguồn được xác minh.

## Quy trình nhóm

Nhóm dùng **migration initial duy nhất** này để thiết lập schema ban đầu; thành viên không tự tạo migration ban đầu thứ hai. Mỗi người checkout cùng commit và chạy migration vào database phát triển riêng của mình.

Không chỉnh migration sau khi đã chia sẻ/áp dụng. Mọi thay đổi tiếp theo cần thư mục migration mới, được review rồi mới commit. `migrate deploy` lần hai sẽ báo không còn migration chờ áp dụng; không chạy `migrate dev`, `db push`, `migrate reset`, seed hoặc SQL diff với database người dùng cho việc này.

## Kiểm thử MySQL dùng một lần

Đã tạo một container không gắn volume và schema `unihub_migration_test`, không chứa dữ liệu người dùng. Container dùng image chính thức `mysql:8.4`, server thực tế **8.4.13**, timezone UTC, `utf8mb4_0900_as_ci`; tài khoản migration/app là credentials ngẫu nhiên chỉ dùng trong container. Sau test, toàn bộ container và credentials sẽ bị xóa. Môi trường này tách khỏi database/máy của nhóm.

- **Kiểm thử initial migration ban đầu:** `migrate deploy` đạt bằng tài khoản migration có quyền trên đúng schema; `migrate status` báo schema up to date; `migrate deploy` lần hai báo không còn migration chờ áp dụng.
- **Initial migration baseline:** metadata MySQL xác nhận 12 bảng nghiệp vụ, 81 cột, 12 PK, 16 FK, 2 UNIQUE, 13 CHECK và `_prisma_migrations` riêng. 12 bảng dùng đúng collation; hai `updated_at` có thuộc tính ON UPDATE. Hành vi FK là một CASCADE / 15 RESTRICT cho DELETE và 16 RESTRICT cho UPDATE.
- **Initial migration constraints:** INSERT tiếng Việt, `academic_year = NULL`, `work_format = NULL` và bài định hướng không publisher thành công. Mỗi một trong 13 CHECK bị thử với giá trị sai và đều bị từ chối; email/tên trùng hoa-thường bị UNIQUE từ chối, tên khác dấu được phân biệt. PK ghép trùng, FK không tồn tại, DELETE/UPDATE RESTRICT đều bị từ chối; xóa event cascade đúng notification.
- Cập nhật trường thường làm `users.updated_at` và `events.updated_at` tăng ít nhất một giây ở độ chính xác DATETIME(0). Transaction DML rollback không để lại dòng. Session tài khoản thử thiết lập timezone UTC thành công.
- Runtime user được phép đọc và ghi theo bảng, xóa event/association; UPDATE/DELETE `activity_logs` và CREATE TABLE bị từ chối. Migration user có ALL PRIVILEGES đúng một schema; không có CREATE DATABASE ở mức máy chủ.
- Bổ sung kiểm tra quyền/transaction bằng SQL trên MySQL tạm 8.4.13: runtime user xóa một notification `Reminder` mà event vẫn còn, reset `events.reminded_at` trong cùng transaction, rồi `ROLLBACK`; notification và giá trị `reminded_at` ban đầu đều được phục hồi. Runtime user vẫn SELECT/INSERT được `activity_logs`; MySQL từ chối UPDATE và DELETE bảng này. Đây là kiểm thử GRANT và transaction trực tiếp ở SQL, **chưa phải kiểm thử API/nghiệp vụ**: chưa xác nhận validation `due_date`/`remind_before`, ownership, điều kiện chọn Reminder cũ hay điều phối transaction trong backend.
- Prisma migrate diff từ database về Prisma schema trả SQL diff rỗng. Điều đó **không phát hiện** CHECK, collation hoặc ON UPDATE do các đặc điểm này không được schema Prisma biểu diễn; đây là giới hạn mong đợi, không phải bằng chứng đã drift-free toàn bộ MySQL metadata. SQL initial migration đã kiểm tra riêng bằng metadata và hành vi phía trên.
- Kiểm thử metadata deadline mới trên container tạm MySQL **8.4.13**, bind cổng chỉ vào `127.0.0.1`, không gắn volume, không đọc `.env` thật: database trống áp dụng thành công initial + deadline migrations; `opportunities` có 17 cột và 4 CHECK (3 CHECK ban đầu + metadata CHECK). Database khác được dựng chỉ bằng initial migration, chèn bản ghi cũ rồi áp dụng migration mới: giá trị `deadline` trước/sau giống nhau và hai metadata của bản ghi cũ là NULL.
- SQL chấp nhận bốn trạng thái: date-only (ngày có/timezone NULL), datetime (ngày NULL/timezone có), no-deadline (cả ba NULL), legacy unknown (deadline có/cả metadata NULL); từ chối metadata khi không có deadline và từ chối hai metadata cùng có giá trị. Một date-only 05/11 và datetime 06/11 00:00 `Asia/Ho_Chi_Minh` lưu cùng instant UTC `2026-11-05T17:00:00Z` nhưng khác metadata; kiểm tra `zoneinfo` xác nhận cutoff date-only ngày kế tiếp 00:00 `Asia/Ho_Chi_Minh` đổi thành `2026-11-05T17:00:00Z`, còn ngày hiển thị lần lượt là 05/11 (ngày nguồn) và 06/11. Đây là kiểm tra migration/giá trị SQL và phép đổi timezone độc lập, **chưa phải kiểm thử API hoặc giao diện**.
- Chạy `migrate deploy` lần thứ hai trên database upgrade báo không có migration chờ; `_prisma_migrations` vẫn có đúng hai migration hoàn tất. Migration initial không bị thay đổi. Chưa có backend nghiệp vụ để kiểm tra timezone input, xác thực zone hợp lệ hoặc phép tính cutoff trong service.
- Prisma validate/generate, typecheck, build, test, format check và audit được chạy lại sau các thay đổi theo từng nhiệm vụ; số test HTTP hiện được ghi trong [README](../README.md). Giữ nguyên Tailwind 3.4.19/Prisma 7.10.1 và override parser đã chốt; `npm ls` còn cảnh báo peer range đã biết về `^6` so với parser 7.1.6, xem [dependency-security.md](dependency-security.md).

Kiểm tra này xác nhận migration trên đúng MySQL 8.4.13 trong Codex/Linux. Nó không chứng minh MySQL phòng học, host/collation khác hoặc máy Windows của thành viên đã sẵn sàng. Prisma runtime hiện dùng adapter/pool cấu hình UTC cho từng physical connection; xem [database-runtime.md](database-runtime.md) để biết kiểm tra tích hợp và hướng dẫn Windows.

MySQL DDL có thể implicit commit; nếu một migration lỗi giữa chừng không giả định `ROLLBACK` sẽ hoàn tác CREATE/ALTER. Trên database dùng một lần, lưu lỗi, kiểm tra `_prisma_migrations`/cấu trúc còn lại, bỏ toàn bộ container test và dựng container/database test mới rồi chạy lại. Không chạy RESET/DROP hướng dẫn này trên database có dữ liệu.

Prisma schema không biểu diễn CHECK, collation mặc định bảng hay `ON UPDATE CURRENT_TIMESTAMP`. Vì thế `migrate diff`/drift check không phải kiểm toán đầy đủ SQL tùy chỉnh; có thể coi khác biệt chỉ nằm ở các phần cố ý này là giới hạn biểu diễn. Không xóa ràng buộc SQL để làm cho diff sạch; review mọi thay đổi schema mới cùng migration SQL.

## Tài liệu chính thức

- [Prisma ORM v7: customize migrations](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/prisma-migrate/workflows/customizing-migrations.mdx) và [CLI reference](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/reference/prisma-cli-reference.mdx) cho `migrate diff`, `migrate status`, `migrate deploy`.
- [Prisma MySQL connector v7](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/core-concepts/supported-databases/mysql.mdx).
- [MySQL 8.4 collation names](https://dev.mysql.com/doc/refman/8.4/en/charset-collation-names.html), [CHECK constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html), [date/time types](https://dev.mysql.com/doc/refman/8.4/en/datetime.html) và [GRANT](https://dev.mysql.com/doc/refman/8.4/en/grant.html). Server 8.4.13 dùng trong test xác nhận collation/runtime SQL thực tế.
