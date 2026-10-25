# Schema Prisma của UniHub

Ngày đối chiếu schema: **24/10/2026**. Tài liệu ghi lại trạng thái lúc schema được tạo; initial migration tiếp theo được chuẩn bị trên nhánh `feat/initial-migration`. Migration và kiểm thử MySQL dùng một lần được mô tả trong [database-migrations.md](database-migrations.md). Database của nhóm/thành viên chưa được thay đổi; chưa seed.

## 1. Nguồn và trạng thái

Scaffold được merge qua PR #2; schema được merge qua PR #3 vào `main` tại `d10ab25`. Initial migration được tạo từ main đó trên nhánh `feat/initial-migration`. Đã đọc AGENTS.md, README, technology-stack, architecture và team-workflow trong repository.

Đã truy cập lại hai nguồn gốc trong phiên làm việc:

- **Chương 4**, 30 trang: `/workspace/attachments/c9e7867e-3c02-4ed7-8528-e2fd832c6079/CHƯƠNG 4.pdf`. Mục 4.2 và 4.3 là căn cứ bảng/cột/khóa, đặc biệt đặc tả 4.3.2.1–4.3.2.12, trang 12–30.
- **Chương 3**, 65 trang: `/workspace/attachments/8eaba411-7586-4eae-aa59-4464586214e5/CHƯƠNG 3.pdf`. Dùng để phân biệt quy tắc hồ sơ, quản trị, sự kiện, giao dịch với ràng buộc database.

Đường dẫn PDF là dấu vết nguồn trong môi trường Codex, không phải tệp được chép vào repository. Bảng chi tiết 81 cột trong [architecture.md](architecture.md#5-đối-chiếu-prisma-với-12-bảng-chương-4) được dùng để đối chiếu, không thay thế việc đọc Chương 4.

Hai quyết định bổ sung đã được người dùng xác nhận trong nhiệm vụ này:

1. Giữ ON DELETE CASCADE cho `notifications.event_id`; ON DELETE RESTRICT cho 15 FK khác; ON UPDATE RESTRICT cho đủ 16 FK.
2. `users.updated_at` và `events.updated_at` cùng dùng cơ chế tự cập nhật tại **MySQL**. Phần ON UPDATE CURRENT_TIMESTAMP phải bổ sung ở nhiệm vụ migration SQL; không thay bằng Prisma `@updatedAt`.

## 2. File và công cụ

| File / thành phần                      | Mục đích                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `backend/prisma/schema.prisma`         | Nguồn schema duy nhất: 12 model, native type MySQL, khóa và quan hệ hai phía                   |
| `backend/prisma.config.ts`             | Cấu hình Prisma CLI 7: vị trí schema, đường dẫn migration và URL riêng của tài khoản migration |
| `backend/src/generated/prisma/`        | Output TypeScript ESM của generator; sinh tự động, không commit, không chỉnh tay               |
| `backend/.env.example`                 | PORT và DATABASE_URL mẫu; không có tài khoản hoặc database thật                                |
| `backend/package.json`, `package.json` | Scripts trong backend và lệnh chuyển tiếp từ root                                              |
| `package-lock.json`                    | Lockfile npm duy nhất cho cả repository                                                        |
| `database/README.md`                   | Chỉ dẫn đến schema chính, không có bộ SQL/schema thứ hai                                       |

Giữ **Prisma CLI 7.10.1** và **@prisma/client 7.10.1** đúng công nghệ đã chọn. CLI là devDependency của backend; @prisma/client cung cấp phần thư viện cho mã client được generator sinh và kiểm tra kiểu. Việc cài thư viện **không tạo instance `new PrismaClient()` hoặc kết nối MySQL**. Chưa thêm adapter runtime, singleton client, query hoặc API nghiệp vụ.

Generator dùng `prisma-client`, `runtime = "nodejs"`, `moduleFormat = "esm"`, output `../src/generated/prisma` tính từ schema. File sinh là `.ts`, import nội bộ có đuôi `.js` để phù hợp cách biên dịch `NodeNext` hiện có. Đã generate và kiểm tra typecheck/build với output này. Khi làm tích hợp runtime sau này phải kiểm tra cả backend dev lẫn bản build cùng adapter; không đổi sang CommonJS hoặc thêm adapter trong nhiệm vụ schema.

Prisma 7 đặt URL ở `prisma.config.ts`, không ở block datasource của schema. Block datasource giữ `provider = "mysql"`, `relationMode = "foreignKeys"`. Config đọc `process.env.DATABASE_URL ?? ''`; không dùng `env()` bắt buộc giá trị và **không tự đọc `.env` thật**. Format/validate/generate không cần kết nối database. Không có postinstall của dự án để generate hoặc kết nối MySQL.

## 3. Kiểm đếm cấu trúc

Đã kiểm đếm từ các khai báo trong file schema, tách scalar field khỏi relation field, đồng thời so tên/thứ tự cột, native type, nullable và mặc định với bản thiết kế. Relation field hai phía phục vụ Prisma không phải cột vật lý.

| Bảng MySQL         | Model Prisma     | Cột vật lý | PK                                |     FK | UNIQUE ngoài PK |
| ------------------ | ---------------- | ---------: | --------------------------------- | -----: | --------------- |
| users              | User             |         10 | user_id, tự tăng                  |      1 | email           |
| categories         | Category         |          5 | category_id, tự tăng              |      0 | (type, name)    |
| opportunities      | Opportunity      |         15 | item_id, tự tăng                  |      1 | —               |
| events             | Event            |         10 | event_id, tự tăng                 |      1 | —               |
| forum_posts        | ForumPost        |          9 | post_id, tự tăng                  |      1 | —               |
| comments           | Comment          |          8 | comment_id, tự tăng               |      2 | —               |
| activity_logs      | ActivityLog      |          9 | log_id, tự tăng                   |      1 | —               |
| notifications      | Notification     |          7 | notification_id, tự tăng          |      2 | —               |
| user_skills        | UserSkill        |          2 | (user_id, skill_id)               |      2 | —               |
| opportunity_majors | OpportunityMajor |          2 | (item_id, major_id)               |      2 | —               |
| opportunity_skills | OpportunitySkill |          2 | (item_id, skill_id)               |      2 | —               |
| opportunity_years  | OpportunityYear  |          2 | (item_id, academic_year)          |      1 | —               |
| **Tổng**           | **12 model**     |     **81** | **12 PK: 8 đơn tự tăng + 4 ghép** | **16** | **2**           |

UNIQUE ở đây không đếm lại tính duy nhất vốn có của PK. Không thêm id vào bảng trung gian, không có many-to-many ngầm định hoặc bảng identity/session. `activity_logs.target_id` là scalar tham chiếu logic, không được tính là FK. Sau này Prisma Migrate có thể tạo `_prisma_migrations` để ghi lịch sử, nhưng đó không phải bảng nghiệp vụ thứ 13 và hiện chưa có bảng này.

### A. Schema Prisma biểu diễn trực tiếp

- Model dùng tên PascalCase và `@@map` giữ nguyên tên bảng; scalar field giữ `snake_case`, không cần `@map` để đổi cột.
- `Int @db.Int`, `Int @db.TinyInt`, `String @db.VarChar(n)`, `String @db.Text`, `DateTime @db.DateTime(0)` giữ kiểu/độ dài của thiết kế. `Boolean` là BOOLEAN/TINYINT(1) theo connector MySQL.
- `?` giữ nullable; không thay NULL bằng chuỗi rỗng. `@default(now())`, số 24, các chuỗi Student/Active/Pending/Upcoming và false chỉ được gắn ở cột có mặc định tương ứng.
- 8 `@id` tự tăng, 4 `@@id` ghép, `users.email @unique`, `categories @@unique([type, name])`.
- 16 quan hệ khai báo `fields`, `references`, `onDelete`, `onUpdate` tường minh; tất cả có relation field chiều ngược. Nullable của relation khớp scalar FK.
- `role`, loại nội dung và trạng thái vẫn là VARCHAR/String. Không có enum mới, không đổi giá trị tiếng Việt thành mã tiếng Anh. **String trong Prisma chưa tự giới hạn role về Student/Admin; CHECK ở phần B mới thực thi giới hạn tại MySQL.**

### Hành vi của 16 FK đã được xác nhận

RESTRICT từ chối xóa bản ghi cha hoặc đổi khóa đang được tham chiếu. Nó không cấm xóa bản ghi con, xóa dòng bảng trung gian hoặc cập nhật cột không phải khóa theo nghiệp vụ. ID định danh không được tự đổi kéo theo toàn bộ liên kết. CASCADE dưới đây chỉ áp dụng khi xóa sự kiện.

| FK                          | Tham chiếu             | ON DELETE   | ON UPDATE |
| --------------------------- | ---------------------- | ----------- | --------- |
| users.major_id              | categories.category_id | RESTRICT    | RESTRICT  |
| opportunities.reviewed_by   | users.user_id          | RESTRICT    | RESTRICT  |
| events.user_id              | users.user_id          | RESTRICT    | RESTRICT  |
| forum_posts.author_id       | users.user_id          | RESTRICT    | RESTRICT  |
| comments.post_id            | forum_posts.post_id    | RESTRICT    | RESTRICT  |
| comments.author_id          | users.user_id          | RESTRICT    | RESTRICT  |
| activity_logs.admin_id      | users.user_id          | RESTRICT    | RESTRICT  |
| notifications.user_id       | users.user_id          | RESTRICT    | RESTRICT  |
| notifications.event_id      | events.event_id        | **CASCADE** | RESTRICT  |
| user_skills.user_id         | users.user_id          | RESTRICT    | RESTRICT  |
| user_skills.skill_id        | categories.category_id | RESTRICT    | RESTRICT  |
| opportunity_majors.item_id  | opportunities.item_id  | RESTRICT    | RESTRICT  |
| opportunity_majors.major_id | categories.category_id | RESTRICT    | RESTRICT  |
| opportunity_skills.item_id  | opportunities.item_id  | RESTRICT    | RESTRICT  |
| opportunity_skills.skill_id | categories.category_id | RESTRICT    | RESTRICT  |
| opportunity_years.item_id   | opportunities.item_id  | RESTRICT    | RESTRICT  |

### B. Ràng buộc phải bổ sung trong migration SQL sau này

Schema chưa thực thi các **13 CHECK được nêu rõ bằng biểu thức CHECK trong Chương 4** dưới đây. Không được coi SQL chỉ sinh từ schema là bản thiết kế database hoàn chỉnh.

| Bảng              | CHECK cần giữ                                                                                                                                                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| users             | `role IN ('Student', 'Admin')`; `academic_year BETWEEN 1 AND 4` (NULL vẫn được phép)                                                                                                                                                                                    |
| categories        | `type IN ('Major', 'Skill')`; `status IN ('Active', 'Closed')`                                                                                                                                                                                                          |
| opportunities     | `work_format IN ('Online', 'Offline', 'Hybrid')` (NULL được phép); `status IN ('Pending', 'Approved', 'Rejected')`; `opportunity_type = 'Bài viết định hướng' OR publisher IS NOT NULL`                                                                                 |
| events            | `remind_before >= 0`; `status IN ('Upcoming', 'Completed', 'Overdue')`                                                                                                                                                                                                  |
| activity_logs     | `action_type IN ('APPROVE_OPPORTUNITY', 'REJECT_OPPORTUNITY', 'DELETE_POST', 'DELETE_COMMENT', 'CREATE_CATEGORY', 'RENAME_CATEGORY', 'CLOSE_CATEGORY', 'REOPEN_CATEGORY', 'CHANGE_ROLE')`; `target_type IN ('Opportunity', 'ForumPost', 'Comment', 'Category', 'User')` |
| notifications     | `type IN ('Reminder', 'Violation')`                                                                                                                                                                                                                                     |
| opportunity_years | `academic_year BETWEEN 1 AND 4`                                                                                                                                                                                                                                         |

`opportunity_type` chỉ nhận `Thực tập`, `Việc làm`, `Học bổng`, `Bài viết định hướng`; `forum_posts.topic` chỉ nhận `Học tập`, `Thực tập`, `Kinh nghiệm phỏng vấn` theo mô tả. Hai miền giá trị này phải được backend kiểm tra; nếu nhóm muốn bổ sung CHECK tương ứng thì review ở nhiệm vụ migration, không tự coi chúng là CHECK đã có trong schema.

**Timestamp:** nhóm đã chọn MySQL tự cập nhật cả `users.updated_at` và `events.updated_at`. Cần giữ `DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` trong SQL migration sau này. Schema hiện chỉ biểu diễn DATETIME và default; chưa có ON UPDATE và không gắn `@updatedAt`. `@updatedAt` chạy ở Prisma Client, không bảo đảm một lệnh SQL ngoài Prisma có cùng hành vi.

**Quyền SQL:** Chương 4 yêu cầu tài khoản ứng dụng chỉ INSERT/SELECT trên activity_logs. GRANT và quyền riêng của tài khoản migration là cấu hình database sau này, không được Prisma schema biểu diễn và chưa được tạo. Collation/charset, cách so sánh hoa-thường của UNIQUE và múi giờ cần đối chiếu khi chuẩn bị database/migration; không suy ra chúng từ kiểm đếm schema. MySQL cần index hỗ trợ FK; index hạ tầng có thể xuất hiện trong SQL sinh ra, không được nhầm với UNIQUE nghiệp vụ bổ sung.

### C. Quy tắc phải xử lý tại backend

| Nhóm quy tắc                 | Phần backend cần bảo đảm                                                                                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Danh tính, role và ownership | Google token/JWT được xác minh; Guest không lưu như role; kiểm tra đúng Student/Admin và chủ sở hữu từng request; FK chỉ kiểm tra bản ghi tồn tại                                             |
| Major/Skill                  | major_id phải trỏ category type Major, skill_id phải trỏ Skill; trạng thái Active/Closed theo use case. FK không kiểm tra type/status của danh mục                                            |
| Hồ sơ và danh mục            | Điều kiện hồ sơ đầy đủ; giữ ít nhất một mục Active mỗi loại; không xóa cứng danh mục; kiểm tra tên không rỗng ngoài UNIQUE                                                                    |
| Cơ hội và duyệt tin          | Miền loại nội dung, format/location, URL nguồn hợp lệ trước duyệt, is_verified, người/thời điểm duyệt, chuyển trạng thái; CHECK publisher IS NOT NULL không loại chuỗi toàn khoảng trắng      |
| Lịch                         | Tạo/đổi hạn yêu cầu hạn tương lai; sửa nội dung được giữ hạn cũ; không tự mở lại Completed; reset nhắc đúng ngữ cảnh                                                                          |
| Diễn đàn/kiểm duyệt          | Miền topic, quyền đăng/bình luận, xóa mềm và lọc nội dung đã xóa, lý do không chỉ có khoảng trắng                                                                                             |
| Log/thông báo                | action/target đúng nghiệp vụ; reason bắt buộc khi từ chối/xóa; Reminder phải gắn sự kiện, Violation không gắn sự kiện; chủ sở hữu mới đánh dấu đọc                                            |
| Giao dịch và cạnh tranh      | Thay đổi nghiệp vụ + log + thông báo cùng transaction; Reminder + reminded_at cùng transaction; xử lý hai request đồng thời để không tạo nhắc trùng hoặc vi phạm số danh mục Active tối thiểu |

FK `reviewed_by`/`admin_id` không xác nhận người được tham chiếu là Admin. CHECK scalar và Prisma validate không kiểm chứng được các quy tắc liên bảng, phiên đăng nhập hoặc giao dịch này.

## 4. Hướng dẫn Windows PowerShell

Các lệnh đều chạy tại **gốc UniHub**, nơi có package.json và package-lock.json gốc. `validate` kiểm tra cấu trúc/ngữ nghĩa schema theo Prisma; `generate` sinh mã TypeScript; **migration** là thay đổi cấu trúc database và chưa được phép chạy trong nhiệm vụ này.

Trước khi chuyển nhánh, chạy `git status`. Nếu có mã chưa commit, lưu an toàn và không reset/clean để chuyển nhánh. Khi working tree sạch:

```powershell
git fetch origin refs/heads/feat/prisma-schema:refs/remotes/origin/feat/prisma-schema
git switch feat/prisma-schema
npm.cmd ci
```

Nếu Git chưa tự tạo nhánh local, dùng `git switch --track origin/feat/prisma-schema`. Hướng dẫn lấy nhánh chỉ dùng sau khi nhánh được push; báo cáo bàn giao xác nhận trạng thái push thực tế.

```powershell
npm.cmd run prisma:format
npm.cmd run prisma:validate
npm.cmd run prisma:generate
```

- Format chỉ chuẩn hóa file schema, có thể tạo diff để review.
- Validate không tạo bảng, không kiểm thử nghiệp vụ hoặc các CHECK chưa có trong schema.
- Generate ghi file vào backend/src/generated/prisma/ được ignore. Không sửa tay, không commit output và không khởi tạo kết nối MySQL.
- Chưa cần tạo `.env` thật hoặc cung cấp DATABASE_URL để thực hiện các lệnh này; config không tự nạp `.env`. Nếu lệnh báo lỗi, dừng và đọc lỗi, không bỏ kiểm tra checksum hoặc đổi phiên bản.

Kiểm tra cấu trúc SQL **chỉ để xem trước**, không nối database:

```powershell
npm.cmd run prisma:diff
```

Script cố định đầu vào là `--from-empty --to-schema prisma/schema.prisma --script`. Nó không áp dụng SQL và không tạo migration trong repository. Nếu chạy được, output vẫn chưa có các CHECK/ON UPDATE/GRANT ở phần B. Không thay các cờ bằng `--from-config-datasource`, `--to-config-datasource` hoặc lệnh truy cập database trong nhiệm vụ này.

Các kiểm tra ứng dụng hiện có, vẫn tại gốc:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run format:check
```

Health và frontend không import client được sinh, không yêu cầu MySQL hoặc DATABASE_URL. Chúng vẫn dùng các lệnh dev trong README. Bộ công cụ Prisma có thể cần tải engine từ binaries.prisma.sh trong lần chạy đầu, kể cả khi không kết nối database.

## 5. Trạng thái kiểm tra schema và giới hạn

- **Đạt kiểm tra tĩnh:** đủ 12 model, 81 scalar column, 12 PK (8 đơn + 4 ghép), 16 FK, 2 UNIQUE ngoài PK; tên/kiểu/nullable/default so với bảng thiết kế; khai báo rõ hành vi đủ 16 FK.
- **Prisma format, validate và generate đạt:** cả ba script ở root hoàn tất với exit code 0, client 7.10.1 được sinh vào thư mục đã ignore. Các lệnh không cần cấp DATABASE_URL hoặc kết nối MySQL.
- **SQL diff offline đạt:** script `prisma:diff` hoàn tất với exit code 0; đã kiểm đếm output đủ 12 bảng, 81 cột, 12 PK, 16 FK, 2 UNIQUE và kiểm tra hành vi FK đúng quyết định. Output chỉ nằm trong tệp tạm ngoài repository, chưa phải migration; không có CHECK hoặc ON UPDATE timestamp, không áp dụng SQL.
- **Typecheck, build và 7 test HTTP đạt**, đã chạy lại sau generate. **Prettier format check đạt**; `.prisma` dùng formatter Prisma riêng. Generated client, node_modules, dist và `.env` thật đều được ignore. Kiểm tra này diễn ra trên Codex/Linux, không kiểm tra MySQL thật, Windows hoặc NFR.

Lần thử đầu gặp 403 khi tải checksum engine từ **binaries.prisma.sh**. Lần kiểm tra cuối đã tải/chạy được bằng CLI chính thức, không bỏ xác minh checksum hoặc TLS. Nếu môi trường khác gặp lỗi này, cần cho phép hostname nguồn engine chính thức trên; đây không phải máy chủ database. Bản nháp cấu hình mạng Codex đã được lưu để review, nhưng lưu draft không tự chứng minh runtime đã áp dụng cấu hình; kết quả đạt ở trên dựa trên exit code thực tế.

SQL diff hiện sinh mặc định `utf8mb4`/`utf8mb4_unicode_ci`; đây là mặc định của công cụ, chưa phải quyết định charset/collation của nhóm và chưa được áp dụng vào database. Cần review trước nhiệm vụ migration vì nó ảnh hưởng so sánh và UNIQUE.

Initial migration đã bổ sung các CHECK, collation, hai `ON UPDATE` và thiết lập timezone đã được xác nhận; chi tiết và kết quả MySQL thật của container test ở [database-migrations.md](database-migrations.md). SQL diff ở trên vẫn chỉ là nền Prisma trước phần SQL tùy chỉnh, không phải nội dung migration hoàn chỉnh.

## 6. Việc còn cần quyết định trước triển khai tiếp

Các quyết định FK/timestamp đã được xác nhận và lưu trong schema/migration. Các điểm sau thuộc nhiệm vụ kế tiếp, không tự mở rộng mô hình 12 bảng:

- Liên kết tài khoản Google lâu dài bằng sub và cơ chế refresh session/thu hồi: users hiện chưa có google_sub, không có bảng session/identity/token.
- Liên kết tài khoản Google lâu dài bằng sub, session/thu hồi token; xem xét khi làm xác thực.
- Xác nhận môi trường môn học hỗ trợ phiên bản đã chọn và kiểm thử trên máy Windows của nhóm.
- Các thay đổi lược đồ mới vẫn cần migration riêng và review theo quy trình trong database-migrations.md.

Database của nhóm không được truy vấn/thay đổi trong nhiệm vụ migration; container kiểm thử tách biệt và bị hủy sau test. Cài/generate và kiểm thử trên MySQL tạm không chứng minh môi trường máy thành viên đã sẵn sàng.

## 7. Nguồn công cụ chính thức

- [Prisma CLI 7.10.1](https://registry.npmjs.org/prisma/7.10.1), [Prisma Client 7.10.1](https://registry.npmjs.org/@prisma%2fclient/7.10.1): metadata phiên bản và engines/peers đã đọc.
- Nguồn tài liệu Prisma v7 tại commit `4651e4f165e02b756a5d627034a017b77fbf07fe`: [Prisma Config](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/reference/prisma-config-reference.mdx), [generator](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/prisma-schema/overview/generators.mdx), [MySQL connector](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/core-concepts/supported-databases/mysql.mdx), [schema reference](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/reference/prisma-schema-reference.mdx), [CLI reference](https://github.com/prisma/docs/blob/4651e4f165e02b756a5d627034a017b77fbf07fe/apps/docs/content/docs/orm/v7/reference/prisma-cli-reference.mdx).
- Prisma engine được CLI 7.10.1 yêu cầu và client sinh ra ghi nhận: commit `d1b3f377ca835d73fd50954a5e22128b9ebdd6b8`.
