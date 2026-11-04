# Chuẩn bị database demo cô lập — 02/11/2026

**READY để leader/DBA review kế hoạch; NOT READY để chạy migration/seed/import.**
Tất cả SQL/lệnh ghi bên dưới là đề xuất sau phê duyệt, chưa được chạy.

## Kết quả kiểm tra chỉ đọc

- MySQL 8.4.13. Runtime đang dùng unihub_app@localhost, database unihub_dev.
- Runtime có DML theo từng bảng trên unihub_dev; activity_logs chỉ SELECT/INSERT,
  auth_sessions SELECT/INSERT/UPDATE; không có DDL hoặc GRANT OPTION thấy được.
- Migration account đang dùng unihub_migrator@localhost, ALL PRIVILEGES chỉ trên
  unihub_dev.\*; global grant chỉ USAGE, không có quyền quản trị/cấp user toàn server.
- Cả hai account chỉ thấy unihub_dev trong hai schema được hỏi
  (unihub_dev/unihub_demo). **Không thấy unihub_demo không có nghĩa DB chưa tồn tại**:
  MySQL ẩn schema mà account không có quyền. DBA phải kiểm tra bằng account quản trị.
- Không có quyền đã thấy trên unihub_demo; chưa có kết nối phù hợp để kiểm tra
  migrations/catalog/batch trên DB demo. Không dùng unihub_dev để thay thế.
- Không đọc/in nội dung .env, password hoặc connection string. Env hiện có chỉ
  được Node nạp vào tiến trình kiểm tra để SELECT metadata và SHOW GRANTS; output
  chỉ chứa account, database và quyền, không chứa authentication material.

## 1. DBA xác minh trước — chỉ đọc

Dùng MySQL client bằng account quản trị, nhập mật khẩu tương tác (không đặt vào
command line). Máy hiện có binary tại đường dẫn dưới, chưa chạy thao tác quản trị:

```powershell
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -h 127.0.0.1 -u DBA_USER -p
```

```sql
SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME
FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'unihub_demo';
SELECT User, Host FROM mysql.user
WHERE User IN ('unihub_demo_migrator', 'unihub_demo_app');
```

Nếu database/account đã tồn tại, dừng phần CREATE; DBA xác nhận chủ sở hữu, các
bảng và dữ liệu có sẵn, cấu hình quyền trước khi quyết định tái sử dụng. Không
DROP, RESET, dùng IF NOT EXISTS để bỏ qua xung đột hoặc sửa account sẵn có.
Không kết luận trạng thái từ phạm vi nhìn thấy của runtime account.

## 2. Đề xuất provisioning — chỉ sau leader/DBA phê duyệt

Chỉ khi DBA xác nhận cả schema và hai account chưa tồn tại, chọn hai mật khẩu
mới khác nhau trong kênh quản trị cục bộ; không lưu SQL đã điền secret vào Git/log.
Các placeholder dưới đây không phải credentials dùng được.

```sql
CREATE DATABASE unihub_demo
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;
CREATE USER 'unihub_demo_migrator'@'localhost'
  IDENTIFIED BY '<NEW-DEMO-MIGRATION-SECRET>';
CREATE USER 'unihub_demo_app'@'localhost'
  IDENTIFIED BY '<NEW-DEMO-RUNTIME-SECRET>';

GRANT CREATE, ALTER, INDEX, REFERENCES, SELECT, INSERT, UPDATE
  ON unihub_demo.* TO 'unihub_demo_migrator'@'localhost';
```

Đây là tập quyền đề xuất theo bốn migration hiện có (CREATE/ALTER bảng, index,
FK và đọc/ghi \_prisma_migrations); chưa thực thi để kiểm chứng trên DB demo.
Không cấp global privileges, CREATE USER, GRANT OPTION, DROP hoặc quyền trên
unihub_dev. Không dùng migrator làm runtime. Nếu migration báo thiếu quyền, DBA
review lỗi cụ thể thay vì tự nâng lên quyền toàn server. Không cần FLUSH PRIVILEGES
khi dùng CREATE USER/GRANT. Với kết nối host khác localhost, DBA phải chốt account
host phù hợp; không đổi sang '%' cho tiện.

## 3. Cấu hình riêng, không ghi đè env hiện tại

Đã chuẩn bị hai template không chứa secret:

- backend/.env.demo.example: runtime unihub_demo_app, DB unihub_demo, port 3002,
  email worker disabled, JWT audience/issuer dành riêng cho demo.
- backend/.env.demo.migration.example: chỉ MIGRATION_DATABASE_URL của
  unihub_demo_migrator, DB unihub_demo.

Chỉ tạo file thật nếu chưa có; chỉnh secret trực tiếp trên máy. Không copy .env
hoặc .env.migration hiện tại, không đặt URL vào biến shell hoặc lịch sử terminal.
Hai file thật đều được .gitignore hiện có bảo vệ.

```powershell
if (Test-Path -LiteralPath backend/.env.demo) { throw 'Demo runtime env already exists; inspect locally.' }
if (Test-Path -LiteralPath backend/.env.demo.migration) { throw 'Demo migration env already exists; inspect locally.' }
Copy-Item -LiteralPath backend/.env.demo.example -Destination backend/.env.demo
Copy-Item -LiteralPath backend/.env.demo.migration.example -Destination backend/.env.demo.migration
```

Node ưu tiên biến môi trường của shell hơn --env-file. Trước mọi nhóm lệnh, dùng
terminal riêng, xác nhận không có DATABASE_URL/MIGRATION_DATABASE_URL hoặc biến
email đang được đặt sẵn; chỉ kiểm tra sự tồn tại, không in giá trị:

```powershell
if (Test-Path Env:DATABASE_URL) { throw 'Inherited DATABASE_URL; use a clean demo terminal.' }
if (Test-Path Env:MIGRATION_DATABASE_URL) { throw 'Inherited MIGRATION_DATABASE_URL; use a clean demo terminal.' }
if (Test-Path Env:EVENT_REMINDER_EMAIL_ENABLED) { throw 'Inherited email flag; use a clean demo terminal.' }
```

Bảo vệ đích trước migration (chạy từ gốc repo):

```powershell
@'
const u=new URL(process.env.MIGRATION_DATABASE_URL); if(u.protocol!=="mysql:" || u.pathname!=="/unihub_demo" || u.username!=="unihub_demo_migrator" || !["localhost","127.0.0.1"].includes(u.hostname)) throw Error("Wrong demo migration target"); console.log("Demo migration URL target checked; no secret printed");
'@ | node --env-file=backend/.env.demo.migration --input-type=module
if ($LASTEXITCODE -ne 0) { throw 'Stop: wrong migration target.' }
```

Bảo vệ đích trước catalog/import/runtime:

```powershell
@'
const u=new URL(process.env.DATABASE_URL); if(u.protocol!=="mysql:" || u.pathname!=="/unihub_demo" || u.username!=="unihub_demo_app" || !["localhost","127.0.0.1"].includes(u.hostname) || process.env.EVENT_REMINDER_EMAIL_ENABLED!=="false") throw Error("Wrong demo runtime target or email flag"); console.log("Demo runtime URL target checked; no secret printed");
'@ | node --env-file=backend/.env.demo --input-type=module
if ($LASTEXITCODE -ne 0) { throw 'Stop: wrong runtime target.' }
```

Các kiểm tra URL chưa chứng minh kết nối thành công hoặc server rỗng. Khi có kết
nối phù hợp, xác nhận thêm `SELECT DATABASE(), CURRENT_USER()` trả đúng demo trước
khi cho phép bất kỳ lệnh ghi nào.

## 4. Migrations — sau phê duyệt tạo DB và chạy migration

Bốn migration được dùng nguyên trạng, theo thứ tự:

1. 20261025000000_initial_schema
2. 20261026150000_add_opportunity_deadline_metadata
3. 20261028170000_add_auth_identity_sessions
4. 20261031000000_add_event_reminder_emails

Kết quả mong đợi: 14 bảng nghiệp vụ cùng \_prisma_migrations. Không dùng migrate dev,
db push, reset, schema diff để apply hoặc tạo migration mới. DDL MySQL có implicit
commit; nếu lỗi giữa chừng, dừng và kiểm tra, không tự xóa/tạo lại database.

Script npm db:migrate:\* hiện nạp backend/.env.migration (dev), nên **không chạy
nguyên script đó** cho demo. Dùng cùng Prisma CLI và config hiện có, nhưng truyền
file demo rõ ràng; schema/migrations vẫn lấy từ backend/prisma:

```powershell
Push-Location backend
try {
  node --env-file=.env.demo.migration ../node_modules/prisma/build/index.js migrate status --config prisma.config.ts
  # DB mới có pending migrations là bình thường; leader phải review output trước deploy.
  # Chỉ chạy dòng sau khi migration đã được duyệt:
  node --env-file=.env.demo.migration ../node_modules/prisma/build/index.js migrate deploy --config prisma.config.ts
  if ($LASTEXITCODE -ne 0) { throw 'Migration failed; stop.' }
  node --env-file=.env.demo.migration ../node_modules/prisma/build/index.js migrate status --config prisma.config.ts
  if ($LASTEXITCODE -ne 0) { throw 'Migration status not ready.' }
} finally { Pop-Location }
```

## 5. Quyền runtime theo bảng — DBA áp dụng sau migration

Tái sử dụng ma trận quyền của dự án cho database demo. Không cấp schema-wide DML
cho runtime để giữ activity_logs không thể UPDATE/DELETE. Các quyền này phục vụ
cả backend demo; catalog/importer chỉ sử dụng phần SELECT/INSERT cần thiết.

```sql
GRANT SELECT, INSERT, UPDATE ON unihub_demo.users TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_demo.categories TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_demo.opportunities TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON unihub_demo.events TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_demo.forum_posts TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_demo.comments TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT ON unihub_demo.activity_logs TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON unihub_demo.notifications TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON unihub_demo.event_reminder_emails TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_demo.user_skills TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_demo.opportunity_majors TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_demo.opportunity_skills TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, DELETE ON unihub_demo.opportunity_years TO 'unihub_demo_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON unihub_demo.auth_sessions TO 'unihub_demo_app'@'localhost';
```

## 6. Seed catalog bằng importer hiện có — phê duyệt riêng

Đã chuẩn bị `data/opportunities/demo/catalog.json`: đúng 445 entries type/name,
117 Major + 328 Skill, không ID/status/user/profile. So khớp toàn bộ với danh mục
Active bằng SELECT từ dev; không sao chép dữ liệu người dùng hoặc cơ hội thật.
Không dùng riêng expanded-majors.json vì file đó không bảo đảm bao gồm Major thứ 117. Category ID ở demo được sinh mới; batch tham chiếu theo tên nên không cần
bảo toàn ID dev.

Build tại gốc repo, rồi bảo vệ URL demo như bước 3. Xác nhận schema demo sau
migration có categories/users/opportunities/auth_sessions rỗng trước seed.

```powershell
npm.cmd run build --workspace @unihub/backend
node --env-file=backend/.env.demo backend/dist/scripts/opportunities-import.js --catalog-only --file data/opportunities/demo/catalog.json --dry-run
```

Kỳ vọng trước seed: writes=0, plan.blocked=false, 445 category create. Nếu có reuse,
không coi DB là database mới rỗng; dừng để kiểm tra nguồn dữ liệu. Sau khi leader
phê duyệt **seed catalog** mới được chạy lệnh ghi sau (chưa thực hiện):

```powershell
node --env-file=backend/.env.demo backend/dist/scripts/opportunities-import.js --catalog-only --file data/opportunities/demo/catalog.json --apply
node --env-file=backend/.env.demo backend/dist/scripts/opportunities-import.js --catalog-only --file data/opportunities/demo/catalog.json --dry-run
```

Kỳ vọng lần hai: 445 reuse, 0 create, writes=0; SELECT xác nhận 117 Major Active,
328 Skill Active, users/auth_sessions/opportunities vẫn rỗng. Không copy user,
profile, session, forum, calendar, notification hoặc outbox từ unihub_dev.

## 7. Kiểm tra batch DEMO trước import — không tự duyệt

100 tin hiện dùng 101 Major + 179 Skill, toàn bộ nằm trong catalog demo 445 entries.
Importer dùng tên danh mục; major_ids/skill_ids trong batch đều rỗng. Schema đã
nullable deadline và có hai metadata; không cần thay schema/contract.

Sau khi có DB demo và catalog, chạy validation dữ liệu không ghi:

```powershell
node --test data/opportunities/demo/demo.test.mjs backend/test/catalog-import.test.mjs backend/test/recommendations.test.mjs
node --env-file=backend/.env.demo backend/dist/scripts/opportunities-import.js --file data/opportunities/demo/batch-proposal.json --dry-run
```

Batch chưa được leader duyệt nên importer vẫn dừng ở **leader approval**, chưa
validate từng item hoặc lập plan trên demo. Không thay needs_review thành
leader_approved để vượt gate. Sau khi leader duyệt batch/catalog/mapping thật sự,
chạy lại dry-run với bằng chứng duyệt đó: kỳ vọng 100 create, 280 category reuse,
0 category create, blocked=false, writes=0. Không có lệnh opportunity --apply trong
kế hoạch này. Pending items chưa xuất hiện trên Public/Recommendations.

Nếu sau này cần chạy backend demo, dùng trực tiếp cấu hình riêng:

```powershell
node --env-file=backend/.env.demo backend/dist/server.js
```

Không dùng npm dev/start hiện tại để khởi động demo vì các script đó nạp .env
runtime cũ. Auth demo cần secret mới và cấu hình Google phù hợp từ template;
không sao chép session/profile. Không khởi động backend trong lượt chuẩn bị này.

## Điểm dừng hiện tại

Chưa xác minh tồn tại/quyền/schema của unihub_demo; chưa có demo credentials thật.
Chỉ tạo templates và catalog names, không tạo file env thật hay đụng env hiện tại.
Chưa chạy MySQL CREATE/GRANT, migration, seed, apply hoặc backend demo worker.
Leader/DBA cần duyệt provisioning và đích trước; catalog seed và batch approval
là hai quyết định tiếp theo, không gộp thành quyền tự động import.
