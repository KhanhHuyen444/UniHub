# Kiến trúc UniHub

Ngày ghi nhận thiết kế: **23/10/2026**; cập nhật Prisma runtime **25/10/2026**. Đã có frontend kỹ thuật React, backend Express, schema, initial migration và adapter MySQL. Prisma Client dùng singleton lazy; `GET /api/health` chỉ kiểm tra HTTP còn `GET /api/ready` truy vấn MySQL. Migration/runtime được kiểm thử trên MySQL tạm ở Codex/Linux; không truy cập database thành viên. Xem [database-schema.md](database-schema.md), [database-migrations.md](database-migrations.md) và [database-runtime.md](database-runtime.md).

Danh sách nguồn đã đọc, đường dẫn PDF, phiên bản công nghệ và giới hạn truy cập Figma nằm trong [technology-stack.md](technology-stack.md). Đối chiếu dữ liệu dùng Chương 4 trang 6–30; quy tắc nghiệp vụ dùng Chương 3. Quyết định mới của nhóm về Google ID token được ưu tiên so với luồng Authorization Code cũ trong Chương 3.

## 1. Thành phần và trách nhiệm

```mermaid
flowchart LR
    U[Trình duyệt desktop 1280–1920 px] --> F[React + TypeScript + Tailwind CSS]
    G[Google Identity Services] -->|Google ID token| F
    F -->|HTTPS: token đăng nhập hoặc REST request| B[Express REST API]
    B -->|Lấy khóa công khai để xác minh Google token| G
    B --> A[Xác thực / phân quyền / kiểm tra input]
    A --> S[Dịch vụ nghiệp vụ và giao dịch]
    S --> P[Prisma Client + adapter MySQL]
    P --> D[(MySQL: 12 bảng nghiệp vụ)]
    B -->|JWT UniHub / dữ liệu / lỗi| F
```

- **Frontend:** một ứng dụng React được build bằng Vite, có khu vực Public, Student, Admin. Public/Student dùng các route trong Chương 4 mục 4.1.1; Admin dùng tiền tố `/admin`, với dashboard, moderation, categories và users. Không tách Admin thành ứng dụng thứ hai. Route guard và 403/404 hỗ trợ điều hướng.
- **Backend:** một REST API Express. Middleware kiểm tra phiên, quyền và dữ liệu đầu vào; service xử lý quy tắc, quyền sở hữu, chuyển trạng thái và transaction. Không tin `role`, `user_id`, `author_id` hoặc `admin_id` do frontend tự khai báo để cấp quyền.
- **Dữ liệu:** chỉ backend sử dụng Prisma và thông tin kết nối MySQL. Prisma không thay thế kiểm tra nghiệp vụ; MySQL chịu trách nhiệm ràng buộc cấu trúc và giao dịch.
- **Tác vụ nền:** nhắc hạn thuộc backend theo Chương 3, triển khai sau. Chưa chọn thư viện lập lịch, chưa thêm queue, Redis, dịch vụ cron ngoài hoặc tiến trình chạy thật.
- **Ranh giới API:** frontend dùng JSON qua REST. Backend có `GET /api/health` (liveness), `GET /api/ready` (readiness database), 404 và error middleware; endpoint nghiệp vụ chưa có. Xem [api-conventions.md](api-conventions.md).

## 2. Luồng xác thực và phân quyền

Luồng đã được nhóm chốt:

1. Frontend sử dụng Google Identity Services và nhận **Google ID token**.
2. Frontend gửi token tới endpoint đăng nhập backend qua HTTPS. Client ID là cấu hình công khai; không đưa Google client secret vào frontend.
3. Backend xác minh chữ ký bằng khóa công khai của Google, issuer, audience khớp client ID cấu hình, hạn token và các claim cần thiết. Chỉ giải mã JSON của JWT không đủ để xác thực. Không tin tên/email/role do client gửi kèm nếu chưa kiểm chứng.
4. Backend xử lý tra cứu tài khoản theo thiết kế đã thống nhất, lấy quyền từ dữ liệu UniHub và phát token **của UniHub**. Google ID token không được dùng thay JWT UniHub cho các API nghiệp vụ.
5. Mọi API được bảo vệ kiểm tra token UniHub, quyền và quyền sở hữu tài nguyên ở backend; frontend guard không phải biện pháp bảo vệ dữ liệu.

Chương 3 trang 7 và UC-04 trang 38–40 quy định access token tối đa 15 phút, refresh token tối đa 7 ngày trong cookie `HttpOnly`, `Secure`, `SameSite=Strict`; khi refresh phải đọc lại role từ database. Đây là yêu cầu cho bước triển khai, chưa có cookie hoặc token được tạo trong nhiệm vụ này. Origin/CORS, chống CSRF, lưu access token, refresh rotation/thu hồi và cấu hình HTTPS cục bộ cần thiết kế khi làm xác thực; không tự thêm bảng hoặc dịch vụ để giải quyết ngay.

| Đối tượng | Ý nghĩa và nguồn quyền |
| --- | --- |
| Guest | Chưa đăng nhập; chỉ truy cập chức năng công khai. Không có giá trị `Guest` trong `users.role`. |
| Student | Tài khoản có `users.role = 'Student'`; backend kiểm tra chủ sở hữu khi thao tác hồ sơ, sự kiện, thông báo. |
| Admin | Tài khoản có `users.role = 'Admin'`; backend kiểm tra quyền cho mọi thao tác quản trị và ghi nhật ký theo use case. |

**Các điểm cần xử lý trước khi triển khai xác thực, không tự đổi schema:**

- UC-04 đang mô tả nhận Authorization Code rồi đổi token; cập nhật tài liệu nghiệp vụ sang Google ID token theo quyết định mới. Không tự thêm bước trao đổi code hoặc yêu cầu client secret cho luồng mới.
- Chương 4 có `users.email UNIQUE`, chưa có cột lưu Google `sub`. `sub` trong ID token là định danh chủ thể Google; email không phải định danh bất biến. Cần nhóm xác nhận cách gắn danh tính Google lâu dài trước khi viết đăng nhập. Hiện giữ nguyên 12 bảng và mọi cột, **không tự thêm `google_sub`** hoặc giả vờ đã giải quyết liên kết tài khoản.
- Chưa có bảng/cột lưu refresh session hoặc token bị thu hồi trong Chương 4. Cơ chế rotation/thu hồi phải được thảo luận khi làm xác thực; không tự bổ sung `sessions`, `refresh_tokens` hoặc kho dữ liệu khác.
- Yêu cầu khởi tạo Admin trong UC-04 là công việc triển khai sau. Không tạo Admin, tài khoản mẫu hoặc seed trong đợt này.

## 3. Cấu trúc scaffold và vị trí Prisma sau này

Theo yêu cầu ngày 24/10/2026, tổ chức frontend theo feature và backend theo module. Cây sau phản ánh phần scaffold chính; các thư mục nghiệp vụ mới có README phạm vi, không có endpoint hoặc component giả:

```text
UniHub/
├── frontend/                    # npm workspace: một ứng dụng React
│   ├── src/
│   │   ├── app/                 # màn hình kỹ thuật kiểm tra backend
│   │   ├── features/            # README theo chức năng, gồm admin/
│   │   ├── components/          # README thành phần dùng chung
│   │   ├── layouts/             # README layout Public/Student/Admin
│   │   ├── lib/                 # fetch health; không truy cập database
│   │   └── styles/              # Tailwind; chưa dựng Figma
│   └── package.json
├── backend/                     # npm workspace: Express REST API
│   ├── src/
│   │   ├── config/              # đọc và kiểm tra cấu hình server
│   │   ├── middleware/          # 404 và xử lý lỗi; chưa có auth
│   │   ├── modules/             # health/readiness có mã; nghiệp vụ chỉ README
│   │   ├── lib/                 # singleton Prisma runtime
│   │   ├── app.ts               # cấu hình Express, không mở cổng
│   │   └── server.ts            # mở cổng, dừng server
│   ├── test/                    # kiểm thử bằng node:test
│   └── package.json
├── database/
│   └── README.md                # chỉ dẫn đến backend/prisma/ sau này
├── docs/
│   ├── technology-stack.md      # phiên bản và phạm vi
│   ├── architecture.md          # tài liệu này; giữ đối chiếu 12 bảng
│   ├── team-workflow.md         # TV1–TV5, nhánh/commit/PR
│   ├── development-roadmap.md   # thứ tự công việc sau scaffold
│   └── api-conventions.md       # health đã chạy, quy ước nghiệp vụ dự thảo
├── package.json                 # private, workspaces: frontend + backend
├── package-lock.json            # một lockfile npm ở gốc
├── .gitignore
├── AGENTS.md                    # hướng dẫn Agent; .env.example ở mỗi workspace
└── README.md                    # tiếng Việt, lệnh chạy đúng trạng thái thực tế
```

Các module chưa có mã dùng README mô tả phạm vi. Admin chia theo chức năng: TV1 users, TV2 opportunities, TV3 categories, TV4 dashboard, TV5 forum; TV1 phối hợp shell/layout chung. Xem [workflow](team-workflow.md), không tạo nhiều kiến trúc cạnh tranh hoặc một file Admin lớn.

**Vị trí dữ liệu duy nhất:** `backend/prisma/schema.prisma` là nguồn schema; `backend/prisma/migrations/` là lịch sử duy nhất, đã có initial migration sau PR #4. Prisma Client được sinh vào `backend/src/generated/prisma/` và không commit. `backend/src/lib/prisma.ts` tạo tối đa một client/pool cho tiến trình và chỉ đọc `DATABASE_URL`; migration dùng `MIGRATION_DATABASE_URL` riêng. Adapter MySQL thiết lập UTC ở từng physical connection; chi tiết phân biệt timezone session với DATETIME nằm trong [database-runtime.md](database-runtime.md). database/ không có bản schema/SQL thứ hai.

Các scripts tại root gồm `dev:frontend`, `dev:backend`, `typecheck`, `build`, `test`, `format`, `format:check`. Backend tự sinh Prisma Client trước dev/typecheck/build; không có migration ở các lifecycle này. Node nạp PORT và `DATABASE_URL` từ `.env` backend; thiếu DB vẫn phục vụ health, readiness trả 503. Frontend dùng Vite proxy `/api`; đây chỉ là cấu hình phát triển. Hướng dẫn ở [README](../README.md).

## 4. Nguyên tắc giữ nguyên mô hình dữ liệu

Đã đối chiếu **8 bảng thực thể + 4 bảng trung gian = 12 bảng nghiệp vụ** ở Chương 4 mục 4.3.2.1–4.3.2.12. Phần dưới là **đặc tả gốc dùng đối chiếu file schema đã tạo**, không phải bằng chứng migration đã chạy. Kết quả kiểm đếm/công cụ thực tế, quyết định FK và timestamp đã xác nhận được ghi riêng trong [database-schema.md](database-schema.md).

- Giữ nguyên tên bảng/cột `snake_case`, tên khóa và kiểu MySQL, độ dài, nullable, mặc định, unique, khóa ghép, khóa ngoại. Model Prisma có thể dùng tên PascalCase với `@@map`; tên field giữ `snake_case` để dễ đối chiếu. Nếu sau này đổi tên field TypeScript sang camelCase, phải có `@map` để tên cột MySQL không đổi.
- Dùng provider `mysql` với khóa ngoại thật (`relationMode = "foreignKeys"`). Không chuyển sang quan hệ chỉ do Prisma mô phỏng.
- Bốn bảng trung gian phải là model tường minh; không dùng many-to-many ngầm định khiến Prisma sinh thêm bảng hoặc cột. `opportunity_years` chỉ liên kết cơ hội với giá trị năm 1–4, không tạo bảng năm học hoặc FK tới categories.
- Không tách `opportunities` thành bảng cơ hội và bảng lộ trình: Chương 4 lưu cả bài viết định hướng trong cùng bảng. Không tách `categories` thành bảng chuyên ngành và kỹ năng.
- Không đổi các cột `VARCHAR` + `CHECK` thành MySQL `ENUM`; dùng Prisma `String` với native type đúng và giữ `CHECK` trong SQL migration. Không mặc định đổi `TEXT` thành `LONGTEXT`, `DATETIME` thành `DATETIME(3)` hoặc `INT` thành `BIGINT`/unsigned.
- Prisma Migrate tạo bảng kỹ thuật `_prisma_migrations` khi migration áp dụng. Đây là lịch sử migration của công cụ, không phải bảng nghiệp vụ thứ 13.

### Quy ước đọc các bảng ánh xạ bên dưới

`?` là cho phép NULL và dùng Prisma scalar optional; trường còn lại là NOT NULL. `NULL` không thay bằng chuỗi rỗng. Cột tùy chọn không có giá trị mặc định khác được để NULL theo thiết kế. `AI` là `@default(autoincrement())`; `now` là `@default(now())` được render thành mặc định thời gian tại MySQL.

| MySQL trong Chương 4 | Biểu diễn Prisma phải giữ |
| --- | --- |
| `INT` | `Int @db.Int` |
| `TINYINT` | `Int @db.TinyInt` |
| `VARCHAR(n)` | `String @db.VarChar(n)` |
| `TEXT` | `String @db.Text` |
| `DATETIME` | `DateTime @db.DateTime(0)` — giữ độ chính xác của DATETIME không khai báo phần lẻ |
| `BOOLEAN` | `Boolean` — connector MySQL ánh xạ sang `TINYINT(1)` |
| PK đơn | `@id`; thêm `@default(autoincrement())` nếu có AI |
| PK ghép | `@@id([cột_1, cột_2])` theo đúng thứ tự thiết kế |
| UNIQUE | `@unique` hoặc `@@unique([...])` |
| FK | Scalar khóa ngoại và trường `@relation(fields: [...], references: [...])`; chiều ngược là relation field, không tạo thêm cột |

## 5. Đối chiếu Prisma với 12 bảng Chương 4

### 5.1. `users` → model `User`, `@@map("users")`

Nguồn: mục 4.3.2.1, trang 12–14. Có **10 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa / mặc định |
| --- | --- | --- |
| `user_id` | INT → Int | PK, AI |
| `email` | VARCHAR(255) → String | UNIQUE |
| `full_name` | VARCHAR(150) → String | — |
| `avatar_url` | VARCHAR(500) → String? | NULL |
| `role` | VARCHAR(10) → String | `'Student'` |
| `major_id` | INT → Int? | FK → categories.category_id; NULL |
| `academic_year` | TINYINT → Int? | NULL |
| `career_goal` | VARCHAR(200) → String? | NULL |
| `created_at` | DATETIME → DateTime | now |
| `updated_at` | DATETIME → DateTime | now; cập nhật khi bản ghi thay đổi |

Database: CHECK role thuộc `Student`, `Admin`; CHECK academic_year từ 1 đến 4 khi có giá trị. Backend: `major_id` phải trỏ danh mục type `Major`; hồ sơ đầy đủ gồm chuyên ngành, năm học và kỹ năng theo Chương 3. `career_goal` không tham gia điểm gợi ý. Chương 4 cho phép cập nhật `users.updated_at` ở DB hoặc ứng dụng; khi triển khai phải chọn rõ cơ chế, không nhầm `@updatedAt` là trigger database. Không có mật khẩu, `Guest`, Google sub hoặc cột session trong bảng hiện tại.

### 5.2. `categories` → model `Category`, `@@map("categories")`

Nguồn: mục 4.3.2.2, trang 14–15. Có **5 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa / mặc định |
| --- | --- | --- |
| `category_id` | INT → Int | PK, AI |
| `type` | VARCHAR(10) → String | — |
| `name` | VARCHAR(100) → String | UNIQUE ghép `(type, name)` |
| `status` | VARCHAR(10) → String | `'Active'` |
| `created_at` | DATETIME → DateTime | now |

Database: `@@unique([type, name])`; CHECK type thuộc `Major`, `Skill`; CHECK status thuộc `Active`, `Closed`. Backend: không xóa cứng; mỗi loại luôn còn ít nhất một mục Active, kiểm tra trong transaction có kiểm soát cạnh tranh. FK không kiểm tra được quy tắc "còn ít nhất một Active".

### 5.3. `opportunities` → model `Opportunity`, `@@map("opportunities")`

Nguồn: mục 4.3.2.3, trang 15–18. Có **15 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa / mặc định |
| --- | --- | --- |
| `item_id` | INT → Int | PK, AI |
| `opportunity_type` | VARCHAR(30) → String | — |
| `title` | VARCHAR(255) → String | — |
| `description` | TEXT → String? | NULL |
| `requirements` | TEXT → String? | NULL |
| `publisher` | VARCHAR(255) → String? | NULL chỉ được chấp nhận theo CHECK bên dưới |
| `location` | VARCHAR(100) → String? | NULL |
| `work_format` | VARCHAR(10) → String? | NULL |
| `deadline` | DATETIME → DateTime? | NULL |
| `status` | VARCHAR(10) → String | `'Pending'` |
| `is_verified` | BOOLEAN → Boolean | false |
| `source_url` | VARCHAR(500) → String? | NULL |
| `reviewed_by` | INT → Int? | FK → users.user_id; NULL |
| `reviewed_at` | DATETIME → DateTime? | NULL |
| `created_at` | DATETIME → DateTime | now |

Database: CHECK work_format thuộc `Online`, `Offline`, `Hybrid` khi có giá trị; CHECK status thuộc `Pending`, `Approved`, `Rejected`; CHECK `opportunity_type = 'Bài viết định hướng' OR publisher IS NOT NULL`. Trường `opportunity_type` chỉ nhận `Thực tập`, `Việc làm`, `Học bổng`, `Bài viết định hướng` theo đặc tả; đây là miền giá trị cần backend xác thực, không tự đổi sang mã tiếng Anh hoặc ENUM.

Backend: location bắt buộc với Offline/Hybrid và NULL với Online; duyệt Approved phải kiểm chứng source_url hợp lệ; `reviewed_by` là Admin được xác thực. Thay đổi trạng thái, `is_verified`, người/thời điểm duyệt và nhật ký phải thống nhất trong giao dịch. Pending/Rejected có `is_verified = false`; không tự đánh dấu Verified cho bài định hướng chỉ vì nó Approved. Bài định hướng được thiết kế nạp sẵn Approved, reviewed_at NULL, không đi qua luồng kiểm duyệt; **chưa tạo dữ liệu này**. Nội dung description/requirements giữ quy ước mục `## Tên mục` và BR-01.8, không tự tách thành bảng mới.

### 5.4. `events` → model `Event`, `@@map("events")`

Nguồn: mục 4.3.2.4, trang 18–21. Có **10 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa / mặc định |
| --- | --- | --- |
| `event_id` | INT → Int | PK, AI |
| `user_id` | INT → Int | FK → users.user_id |
| `title` | VARCHAR(255) → String | — |
| `due_date` | DATETIME → DateTime | — |
| `remind_before` | INT → Int | 24 |
| `notes` | VARCHAR(1000) → String? | NULL |
| `status` | VARCHAR(10) → String | `'Upcoming'` |
| `reminded_at` | DATETIME → DateTime? | NULL |
| `created_at` | DATETIME → DateTime | now |
| `updated_at` | DATETIME → DateTime | now và tự cập nhật tại database |

Database: CHECK remind_before >=0; CHECK status thuộc `Upcoming`, `Completed`, `Overdue`. `updated_at` có `NOW() ON UPDATE NOW()` trong Chương 4: migration SQL phải giữ tương đương `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`. Chỉ gắn Prisma `@updatedAt` sẽ không bảo vệ các lệnh SQL cập nhật ngoài Prisma.

Backend: khi tạo mới hoặc đổi hạn, due_date phải lớn hơn hiện tại; khi chỉ sửa nội dung được giữ hạn cũ đã qua. Kiểm soát chuyển trạng thái, không tự mở lại Completed. Đổi due_date/remind_before phải reset reminded_at và xóa Reminder cũ trong cùng giao dịch. Tạo Reminder và cập nhật reminded_at phải nguyên tử, có kiểm soát việc hai tác vụ cùng nhắc một sự kiện; không tự thêm khóa unique trái thiết kế.

### 5.5. `forum_posts` → model `ForumPost`, `@@map("forum_posts")`

Nguồn: mục 4.3.2.5, trang 21–22. Có **9 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa / mặc định |
| --- | --- | --- |
| `post_id` | INT → Int | PK, AI |
| `author_id` | INT → Int | FK → users.user_id |
| `topic` | VARCHAR(30) → String | — |
| `title` | VARCHAR(255) → String | — |
| `content` | TEXT → String | — |
| `is_deleted` | BOOLEAN → Boolean | false |
| `deleted_at` | DATETIME → DateTime? | NULL |
| `deleted_reason` | VARCHAR(500) → String? | NULL |
| `created_at` | DATETIME → DateTime | now |

Backend: topic thuộc `Học tập`, `Thực tập`, `Kinh nghiệm phỏng vấn`; tác giả phải là Student được xác thực. Admin chỉ xóa mềm; lý do bắt buộc, không chỉ có khoảng trắng khi xóa. Nội dung bị xóa không được trả ra diễn đàn công khai. Xóa mềm, log và thông báo Violation phải cùng giao dịch; không suy diễn FK thành cơ chế kiểm duyệt.

### 5.6. `comments` → model `Comment`, `@@map("comments")`

Nguồn: mục 4.3.2.6, trang 22–23. Có **8 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa / mặc định |
| --- | --- | --- |
| `comment_id` | INT → Int | PK, AI |
| `post_id` | INT → Int | FK → forum_posts.post_id |
| `author_id` | INT → Int | FK → users.user_id |
| `content` | TEXT → String | — |
| `is_deleted` | BOOLEAN → Boolean | false |
| `deleted_at` | DATETIME → DateTime? | NULL |
| `deleted_reason` | VARCHAR(500) → String? | NULL |
| `created_at` | DATETIME → DateTime | now |

Backend: Student mới được bình luận; kiểm tra trạng thái bài đăng, quyền và nội dung. Xóa mềm/lý do/log/Violation theo quy tắc tương tự forum_posts. FK chỉ bảo đảm bài đăng và người dùng tồn tại, không kiểm tra role hoặc is_deleted.

### 5.7. `activity_logs` → model `ActivityLog`, `@@map("activity_logs")`

Nguồn: mục 4.3.2.7, trang 23–26. Có **9 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa / mặc định |
| --- | --- | --- |
| `log_id` | INT → Int | PK, AI |
| `admin_id` | INT → Int | FK → users.user_id |
| `action_type` | VARCHAR(30) → String | — |
| `target_type` | VARCHAR(20) → String | — |
| `target_id` | INT → Int | Tham chiếu logic, **không FK** |
| `old_value` | VARCHAR(500) → String? | NULL |
| `new_value` | VARCHAR(500) → String? | NULL |
| `reason` | VARCHAR(500) → String? | NULL |
| `created_at` | DATETIME → DateTime | now |

Database: CHECK action_type thuộc `APPROVE_OPPORTUNITY`, `REJECT_OPPORTUNITY`, `DELETE_POST`, `DELETE_COMMENT`, `CREATE_CATEGORY`, `RENAME_CATEGORY`, `CLOSE_CATEGORY`, `REOPEN_CATEGORY`, `CHANGE_ROLE`; CHECK target_type thuộc `Opportunity`, `ForumPost`, `Comment`, `Category`, `User`. Cấp quyền tài khoản ứng dụng chỉ INSERT/SELECT trên activity_logs theo Chương 4; tài khoản migration là trách nhiệm cấu hình riêng sau này. Prisma schema không biểu diễn GRANT này.

Backend: admin_id thực sự phải có quyền Admin; action_type/target_type/target_id phải khớp hành động. Reason bắt buộc cho từ chối cơ hội, xóa bài và xóa bình luận. Nhật ký append-only, ghi cùng transaction nghiệp vụ. Không có updated_at, không thêm quan hệ đa hình hoặc FK cho target_id; không dùng cascade xóa mất lịch sử.

### 5.8. `notifications` → model `Notification`, `@@map("notifications")`

Nguồn: mục 4.3.2.8, trang 26–28. Có **7 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa / mặc định |
| --- | --- | --- |
| `notification_id` | INT → Int | PK, AI |
| `user_id` | INT → Int | FK → users.user_id |
| `event_id` | INT → Int? | FK → events.event_id; NULL; **ON DELETE CASCADE** |
| `type` | VARCHAR(20) → String | — |
| `content` | VARCHAR(500) → String | — |
| `is_read` | BOOLEAN → Boolean | false |
| `created_at` | DATETIME → DateTime | now |

Database: CHECK type thuộc `Reminder`, `Violation`; relation event là optional và khai báo `onDelete: Cascade` đúng đặc tả. Backend: Reminder bắt buộc gắn sự kiện, Violation để event_id NULL; kiểm tra người nhận và chỉ chủ sở hữu được đánh dấu đã đọc. Reminder đi cùng cập nhật events.reminded_at; Violation đi cùng xóa mềm và log trong transaction.

### 5.9. `user_skills` → model `UserSkill`, `@@map("user_skills")`

Nguồn: mục 4.3.2.9, trang 28. Có **2 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa |
| --- | --- | --- |
| `user_id` | INT → Int | PK ghép; FK → users.user_id |
| `skill_id` | INT → Int | PK ghép; FK → categories.category_id |

Database: `@@id([user_id, skill_id])`, chống trùng cặp. Backend: skill_id phải có type `Skill`; áp dụng quy tắc trạng thái danh mục của use case. Không thêm id tự tăng hoặc timestamp.

### 5.10. `opportunity_majors` → model `OpportunityMajor`, `@@map("opportunity_majors")`

Nguồn: mục 4.3.2.10, trang 28–29. Có **2 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa |
| --- | --- | --- |
| `item_id` | INT → Int | PK ghép; FK → opportunities.item_id |
| `major_id` | INT → Int | PK ghép; FK → categories.category_id |

Database: `@@id([item_id, major_id])`. Backend: major_id phải có type `Major`. Không sinh thêm bảng liên kết ngầm định.

### 5.11. `opportunity_skills` → model `OpportunitySkill`, `@@map("opportunity_skills")`

Nguồn: mục 4.3.2.11, trang 29. Có **2 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa |
| --- | --- | --- |
| `item_id` | INT → Int | PK ghép; FK → opportunities.item_id |
| `skill_id` | INT → Int | PK ghép; FK → categories.category_id |

Database: `@@id([item_id, skill_id])`. Backend: skill_id phải có type `Skill`. Bảng này đối chiếu với user_skills để gợi ý, không lưu điểm gợi ý mới ngoài thiết kế.

### 5.12. `opportunity_years` → model `OpportunityYear`, `@@map("opportunity_years")`

Nguồn: mục 4.3.2.12, trang 29–30. Có **2 cột**.

| Cột | Kiểu MySQL → scalar Prisma | Khóa |
| --- | --- | --- |
| `item_id` | INT → Int | PK ghép; FK → opportunities.item_id |
| `academic_year` | TINYINT → Int | PK ghép; CHECK 1–4 |

Database: `@@id([item_id, academic_year])`, CHECK academic_year BETWEEN 1 AND 4. Không FK từ academic_year tới categories hoặc bảng khác.

## 6. Ranh giới database và backend

| Nhóm ràng buộc | Nơi bảo đảm chính | Cách đưa vào triển khai sau này |
| --- | --- | --- |
| PK, FK, NOT NULL, kiểu/độ dài, UNIQUE email, UNIQUE `(type, name)`, bốn PK ghép | MySQL | Prisma scalar/native type, `@id`, `@unique`, `@@id`, `@@unique`, `@relation`; review SQL thực sinh |
| Các CHECK được ghi trong Chương 4 | MySQL, backend kiểm tra sớm để báo lỗi rõ | SQL trong migration được review; không bỏ CHECK hoặc thay VARCHAR bằng ENUM |
| `notifications.event_id ON DELETE CASCADE` | MySQL | Relation Prisma optional với `onDelete: Cascade` |
| Cập nhật tự động `events.updated_at` | MySQL | SQL `ON UPDATE CURRENT_TIMESTAMP`; không chỉ dùng `@updatedAt` |
| Major phải trỏ danh mục Major, Skill phải trỏ Skill; người thao tác đúng role | Backend | Đọc dữ liệu liên quan và kiểm tra trong service; FK chỉ kiểm tra bản ghi tồn tại |
| Quyền sở hữu hồ sơ/sự kiện/thông báo; Guest chỉ đọc công khai | Backend | Lấy danh tính từ phiên đã xác thực, kiểm tra từng yêu cầu và tài nguyên |
| Còn ít nhất một danh mục Active mỗi loại; quy tắc quản trị tài khoản trong Chương 3 | Backend + transaction MySQL | Thiết kế khóa/cô lập hoặc kiểm soát cạnh tranh; kiểm tra rồi cập nhật rời rạc chưa đủ |
| Chuyển trạng thái, duyệt nguồn, location, due_date, lý do xóa/từ chối | Backend | Validation theo ngữ cảnh use case; không coi constraint scalar là đủ |
| Log chỉ thêm | Backend và quyền MySQL | Service không sửa/xóa log; tài khoản runtime chỉ INSERT/SELECT trên bảng log |
| Nghiệp vụ + log + notification; nhắc hạn + reminded_at | Backend điều phối, MySQL commit/rollback | Prisma transaction và kiểm soát đồng thời, bảo đảm thành công/thất bại cùng nhau |

**Quyết định bổ sung đã xác nhận ngày 24/10/2026:** ngoài ON DELETE CASCADE của `notifications.event_id` có sẵn trong Chương 4, nhóm chọn ON DELETE RESTRICT cho 15 FK khác và ON UPDATE RESTRICT cho cả 16 FK. Schema khai báo tường minh, không dùng default ORM. Nhóm cũng chọn MySQL tự cập nhật cả `users.updated_at` và `events.updated_at`; initial migration đã ghi ON UPDATE CURRENT_TIMESTAMP, không thay bằng `@updatedAt`. Đây là quyết định bổ sung của nhóm, không được trình bày như nội dung vốn có của Chương 4.

SQL `CHECK` theo thiết kế cũng không bảo đảm mọi điều kiện nghiệp vụ: ví dụ `publisher IS NOT NULL` không loại chuỗi toàn khoảng trắng; FK `reviewed_by` không bảo đảm role Admin. Backend vẫn phải kiểm tra. Không thêm trigger, index nghiệp vụ hoặc constraint chưa được thống nhất chỉ để làm mô hình trông hoàn chỉnh hơn.

## 7. Kiểm tra trước khi chuyển sang mã nguồn

Đã kiểm tra tài liệu ở mức tĩnh: 12 bảng, **81 cột nghiệp vụ**, 8 PK tự tăng, 4 PK ghép và 16 FK; `activity_logs.target_id` không được tính là FK. Có 13 nhóm quan hệ trong bảng 4.2.1 của Chương 4; một quan hệ nhiều-nhiều dùng hai FK ở bảng trung gian nên số nhóm quan hệ khác số FK vật lý.

Sau scaffold, các bước tiếp theo và phạm vi kiểm tra:

1. Đối chiếu môi trường môn học với Node/MySQL đã chọn; giữ phiên bản và một lockfile npm ở gốc.
2. Hai workspace tối thiểu, Tailwind 3/PostCSS và build target trình duyệt đã được cấu hình; duy trì kiểm tra typecheck/build, HTTP test và khởi động khi sửa. Chưa đưa chức năng nghiệp vụ vào scaffold.
3. Initial migration đã có trên `main` qua PR #4; schema, CHECK, FK, collation, timestamp và GRANT đã được kiểm tra trên MySQL tạm theo [database-migrations.md](database-migrations.md). Runtime adapter/readiness và quyền tài khoản ứng dụng được kiểm tra riêng tại [database-runtime.md](database-runtime.md).
4. Đối chiếu Node/MySQL với môi trường môn học và kiểm tra kết nối trên từng máy Windows. Mọi thay đổi dữ liệu tiếp theo phải dùng migration mới, được review trước khi áp dụng vào database phát triển riêng.
5. Trước khi làm auth, xử lý các điểm Google identity/session ở mục 2; trước khi làm UI, đọc được Figma đúng node `318-2` và đối chiếu token thiết kế.

Hiện có health/readiness HTTP, màn hình kỹ thuật frontend, schema và Prisma runtime; xem [trạng thái schema](database-schema.md#5-trạng-thái-kiểm-tra-và-giới-hạn) và [kiểm tra runtime](database-runtime.md). Chưa có API nghiệp vụ, UI chính thức, dữ liệu mẫu hoặc hosting. Runtime chưa được đối chiếu với MySQL máy Windows của thành viên; pool cấu hình nhỏ chưa phải bằng chứng NFR hiệu năng hoặc 100 người dùng đồng thời.
