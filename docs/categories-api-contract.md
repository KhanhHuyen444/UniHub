# Hợp đồng API đọc danh mục dùng chung

> **Major phục vụ Hub do TV1 triển khai và merge vào `main` qua PR #13; TV3 tiếp quản và tái sử dụng module/API này.** Consumer frontend có trên `main` sau PR #12. Contract Skill, hồ sơ Closed và các thao tác Admin phía dưới đã được leader duyệt; routes chưa triển khai. TV2/TV3 thực hiện theo contract đã duyệt. Quyết định về liên kết Major/Skill Closed trong cơ hội đã được chốt riêng và không tự áp dụng cho hồ sơ.

## 1. Mục tiêu, phạm vi và nguồn

TV1 đã triển khai và merge Major API qua PR #13; TV3 tiếp quản module `categories` để duy trì/tái sử dụng endpoint dùng chung và thực hiện các phần khác sau khi leader duyệt contract. TV1 là consumer Major Active cho bộ lọc Hub. Không tạo endpoint danh mục trong `opportunities`. Skill options và Admin CRUD dưới đây đã có contract nhưng chưa có code. Không bao gồm seed hoặc thay đổi schema/migration/GRANT.

Nguồn đã đối chiếu:

| Nguồn                                                                                                                                                  | Phần có liên quan                                                                 | Điều nguồn đó xác nhận                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHƯƠNG 3.pdf` (tệp đính kèm)                                                                                                                          | FR-01.2; UC-05; FR-02.2, BR-02.3–02.4; FR-03.1, UC-03, BR-03.2–03.3; SYS-02/UC-13 | Hồ sơ Student chọn Major và Skill Active; Hub và lộ trình liệt kê Major Active; Guest/Student dùng Hub và lộ trình công khai; Admin quản lý hai loại danh mục. |
| `CHƯƠNG 4.pdf` (tệp đính kèm)                                                                                                                          | Sitemap §4.1.1; ERD/quan hệ §4.2; bảng `categories` §4.3.2.2                      | Major và Skill dùng chung bảng, có `type`, `name`, `status`; Admin đóng/mở chứ không xóa cứng.                                                                 |
| `PCCV-UNIHUB - Trang tính4.pdf` (tệp đính kèm)                                                                                                         | Bối cảnh phân công dự án                                                          | Được xem cùng yêu cầu phân công hiện tại; ranh giới TV1/TV2/TV3 trong hợp đồng này theo yêu cầu mới nhất và [team-workflow.md](team-workflow.md).              |
| [Chương trình database](database-schema.md), `backend/prisma/schema.prisma`, migration initial                                                         | Model `Category`, CHECK, UNIQUE và collation MySQL                                | Cấu trúc hiện thực của `categories`; không phải quy tắc phân quyền hay lựa chọn dữ liệu API.                                                                   |
| [Handoff Figma](shared-ui-design/README.md), frame [36:39 — Hub cơ hội-V2](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=36-39) | Select bộ lọc Hub và option chuyên ngành minh họa                                 | Có control chọn chuyên ngành; không xác nhận endpoint, tên field, quyền, cách xử lý Closed hoặc nội dung production.                                           |

Phân công TV1–TV5 dùng trong tài liệu theo yêu cầu hiện tại: TV1 làm nền auth backend/frontend dùng chung và Hub/chi tiết; TV2 làm hồ sơ/tài khoản; TV3 làm lộ trình, gợi ý và danh mục. Đây là vai trò nhóm đã phân công, không phải dữ liệu suy ra từ Figma.

## 2. Điều đã có căn cứ và quyết định đã chốt

**Căn cứ trong tài liệu:** Chương 3 BR-02.3 yêu cầu lựa chọn chuyên ngành của Hub lấy từ D6 và chỉ gồm Active; BR-02.4 cho phép Guest và Student dùng tìm kiếm/lọc không cần đăng nhập. UC-03/BR-03.3 cũng chọn Major Active cho trang lộ trình công khai. UC-05 dùng danh sách Major và Skill Active trong biểu mẫu hồ sơ Student. Chương 4 §4.3.2.2 đặt hai loại trong bảng `categories` và yêu cầu đóng/mở, không xóa cứng.

**Quyết định nhóm đã duyệt:** bộ chọn Hub dùng `GET /api/categories?type=Major`, công khai và chỉ trả Major Active; response có `id`, `name`, `type`, sắp xếp `name ASC, category_id ASC`. `type` bắt buộc; không nhận `status` hoặc query không hỗ trợ. Không có kết quả trả 200 với `items: []`; chưa có phân trang/tìm kiếm. Major/Skill Closed đã liên kết với cơ hội vẫn giữ liên kết và tên; tìm kiếm theo Skill đã gắn vẫn tính cả Skill Closed. Hub gửi `majorId` Closed nhận 400/`INVALID_FILTER`; frontend cho người dùng xóa bộ lọc, không tự bỏ điều kiện. Quyết định trong Hub không đặt quy tắc hiển thị Closed cho hồ sơ.

**Đã được leader chốt:** Skill options chỉ dành cho Student (Guest 401, Admin 403); Admin dùng API quản lý danh mục riêng. Options chỉ trả Active. Hồ sơ hiển thị danh mục Closed đã liên kết và cho giữ nguyên liên kết hiện tại, nhưng không được thêm/chọn Closed mới. Danh mục không hard-delete, mục mới tạo ở Active, không đóng mục Active cuối cùng của từng type; thay đổi và audit log cùng transaction. Các quyết định này không thay đổi hợp đồng Major đã triển khai.

## 3. Contract đã duyệt: Major cho Hub

### `GET /api/categories?type=Major`

| Thuộc tính          | Quyết định đã duyệt                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Method/path         | `GET /api/categories?type=Major`                                                                            |
| Query `type`        | Bắt buộc; giá trị ở contract Hub là `Major`. Thiếu/lặp/sai hoặc query không hỗ trợ trả 400/`INVALID_QUERY`. |
| Query `status`      | Không được hỗ trợ, kể cả `status=Active` hay `status=Closed`; API luôn giới hạn trạng thái ở server.        |
| Quyền               | Public cho Guest và Student; không cần đăng nhập. Phiên Admin không mở rộng kết quả, vẫn chỉ Major Active.  |
| Tập kết quả         | Chỉ hàng có `type = Major` và `status = Active`.                                                            |
| Response            | `items` gồm `id`, `name`, `type`; không trả `status` hoặc `created_at`.                                     |
| Thứ tự              | `name ASC`, rồi `category_id ASC` theo collation MySQL hiện có.                                             |
| Phân trang/tìm kiếm | Không có trong contract Hub đã duyệt.                                                                       |
| Không có kết quả    | HTTP 200, `items: []`. Lỗi database không được giả thành danh sách rỗng.                                    |

Không tạo endpoint danh mục trong module `opportunities`; TV1 dùng API Major đã triển khai và merge, TV3 tiếp quản provider chung. `type=Skill` đã được leader duyệt nhưng chưa triển khai.

### Query lỗi và lỗi server

Giữ envelope `error.code`/`error.message` theo [api-conventions.md](api-conventions.md). Thông báo lỗi không chứa SQL, Prisma, cấu hình, stack trace hoặc dữ liệu nhạy cảm.

| Tình huống Major                                                                  | HTTP / `error.code`         | Hành vi                                                              |
| --------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| Thiếu/lặp/sai `type`, `type` khác `Major`, query `status` hoặc query không hỗ trợ | 400 / `INVALID_QUERY`       | Không bỏ qua tham số lỗi hoặc tự lấy giá trị đầu/cuối.               |
| Database không sẵn sàng                                                           | 503 / `SERVICE_UNAVAILABLE` | Lỗi chung; không giả thành kết quả rỗng, không lộ chi tiết database. |
| Lỗi bất ngờ                                                                       | 500 / `INTERNAL_ERROR`      | Lỗi chung; không lộ stack trace/configuration.                       |

`INVALID_QUERY`, `SERVICE_UNAVAILABLE` và `INTERNAL_ERROR` theo quy ước API repository. Query `type=Skill` đã được leader duyệt nhưng chưa triển khai.

## 4. Response Major đã duyệt

### HTTP 200

Chỉ có các trường cần để dựng option. Ví dụ dưới đây là **dữ liệu hư cấu minh họa, chưa seed và không phản ánh danh mục production**:

```json
{
  "items": [
    {
      "id": 12,
      "name": "Kỹ thuật phần mềm",
      "type": "Major"
    }
  ]
}
```

Nếu không có Major Active thì trả HTTP 200 với `{"items": []}` theo quyết định đã duyệt. Lỗi truy vấn/database không được biến thành `items: []`. Chương 4 yêu cầu luôn còn ít nhất một Active mỗi loại và kiểm tra ở tầng nghiệp vụ; đó không phải CHECK của database, nên response rỗng vẫn cần định nghĩa an toàn.

### Ánh xạ và trường trả về

| API                         | Schema / database        | Trả?  | Ghi chú                                                                               |
| --------------------------- | ------------------------ | ----- | ------------------------------------------------------------------------------------- |
| `id`                        | `categories.category_id` | Có    | Số nguyên; client gửi `id` Major qua `majorId` cho API cơ hội.                        |
| `name`                      | `categories.name`        | Có    | Tên hiện tại của danh mục.                                                            |
| `type`                      | `categories.type`        | Có    | Giá trị luôn là `Major` trong contract đã duyệt. Contract Skill đã được leader duyệt. |
| điều kiện `status = Active` | `categories.status`      | Không | Server lọc; không trả status vì endpoint chỉ cung cấp lựa chọn hiện hành.             |
| `created_at`                | `categories.created_at`  | Không | Không cần cho option, không phải metadata quản trị.                                   |

Major API không trả thông tin quản trị hoặc Closed. Đổi tên danh mục có hiệu lực trên liên kết theo Chương 4; các response nội dung/detail phải lấy tên hiện hành. Quy tắc đó không biến endpoint options thành nguồn dữ liệu lịch sử.

## 5. Lọc và thứ tự theo database hiện có

`Category` ánh xạ bảng `categories` có 5 cột: `category_id`, `type`, `name`, `status`, `created_at`; UNIQUE `(type, name)`. CHECK giới hạn `type` vào `Major`/`Skill` và `status` vào `Active`/`Closed`. Đây là ràng buộc database, không phải authorization.

Database hiện dùng `utf8mb4_0900_as_ci`: so sánh/sắp xếp tên không phân biệt hoa thường nhưng phân biệt dấu. `UNIQUE(type, name)` vì vậy không nhận hai tên cùng loại chỉ khác hoa/thường; khác dấu vẫn có thể là hai tên khác nhau. Major Active và Skill Active đều sắp xếp theo collation cột hiện tại, `name ASC, category_id ASC`. Khóa ID phụ bảo đảm thứ tự xác định khi tên so sánh bằng nhau theo collation; không đổi collation hay thêm trường chuẩn hóa. Đây là quy tắc contract đã duyệt cho options cả hai loại.

Backend phải xác thực query Major chính xác trước truy vấn. Không dựa vào collation MySQL để chấp nhận `major` như `Major`. CHECK `type/status` không tự lọc response và không thay thế kiểm tra query.

## 6. Phối hợp module

| Nhu cầu                                                         | Bên cung cấp                                  | Bên sử dụng                          | Hợp đồng/phụ thuộc                                                                                                                                                                                           |
| --------------------------------------------------------------- | --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Major Active cho bộ lọc Hub cơ hội                              | TV1 đã triển khai; TV3 tiếp quản `categories` | TV1 — `opportunities`                | Contract Major đã được nhóm duyệt; backend endpoint và frontend consumer đã có trên `main` sau PR #13 và PR #12; luồng được kiểm tra end-to-end trong [báo cáo tích hợp](opportunities-integration-test.md). |
| Major Active cho lựa chọn chuyên ngành trong lộ trình công khai | TV3 — `categories`/`guidance`                 | TV3 — `guidance`                     | Chương 3 UC-03/BR-03.3 yêu cầu Major Active; không tạo endpoint category thứ hai trong guidance.                                                                                                             |
| Major/Skill Active cho hồ sơ                                    | TV3 tiếp quản `categories` sau PR Major       | TV2 — `profile`                      | UC-05 yêu cầu Major và Skill Active; Skill options Student-only và cách giữ liên kết hồ sơ Closed đã được leader duyệt, chưa triển khai.                                                                     |
| Skill trong lộ trình/chi tiết cơ hội                            | TV3 — `guidance`, TV1 — `opportunities`       | Guest/Student đọc nội dung tương ứng | Lấy skill đã gắn từ response nội dung; API options Active không được dùng để xóa/ẩn link Closed. Closed link trong cơ hội tiếp tục theo quyết định nhóm đã chốt.                                             |
| Quản trị danh mục                                               | TV3 — `categories`                            | Admin                                | Tạo/sửa/đóng/mở/đọc Closed thuộc contract Admin riêng; không thêm vào API đọc options này.                                                                                                                   |

Frontend consumer trên `main` gọi `GET /api/categories?type=Major` và parse `{"items":[{"id":12,"name":"Kỹ thuật phần mềm","type":"Major"}]}`. Provider Major đã có trên `main` sau PR #13. Kiểm thử tích hợp đã xác nhận endpoint chỉ trả Major Active, xử lý thành công danh sách rỗng tách biệt với lỗi tải, và consumer hiển thị trạng thái tương ứng. Frontend không giả định option luôn còn Active. Nếu category bị đóng sau khi tải option, API cơ hội trả 400/`INVALID_FILTER`; UI báo bộ lọc không còn hợp lệ và cho người dùng xóa. Lỗi tải categories có error/retry state riêng, không hiển thị như `items: []`.
Đối với bản ghi liên kết Closed, tách rõ ba việc: endpoint options chỉ trả Active; endpoint nội dung có thể trả liên kết đã tồn tại theo quy tắc của module; endpoint Admin quản lý Closed ngoài phạm vi. Không suy ra rằng mọi module phải xóa hoặc ẩn liên kết cũ.

## 7. Ma trận kiểm thử

| Ca kiểm thử                                                               | Kỳ vọng                                                                                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Guest/Student gọi `type=Major`, có Major Active                           | 200; chỉ Major Active, đúng shape và thứ tự.                                                                         |
| Major không có kết quả Active                                             | 200, `items: []`; không coi đây là lỗi.                                                                              |
| Gọi `type=Major` khi có Skill Active/Closed                               | Không có Skill trong response.                                                                                       |
| Có Major Closed                                                           | Không xuất hiện trong options dù có request từ Admin; không hỗ trợ cách lấy Closed qua endpoint này.                 |
| Student gọi `type=Skill`                                                  | 200; chỉ Skill Active, đúng shape và thứ tự `name ASC, category_id ASC`.                                             |
| Guest gọi `type=Skill`; Admin gọi route options                           | Guest 401/`UNAUTHORIZED`; Admin 403/`FORBIDDEN`; Admin dùng API quản lý riêng.                                       |
| Tên giống nhau về hoa/thường hoặc khác dấu                                | Thứ tự tuân collation MySQL đã cấu hình; tie-break `category_id ASC`. Unique cùng loại chặn tên chỉ khác hoa/thường. |
| `type` thiếu, lặp, sai case hoặc không hỗ trợ; có query `status`/query lạ | 400/`INVALID_QUERY`; không âm thầm chuẩn hóa/bỏ tham số.                                                             |
| Database lỗi                                                              | 503/`SERVICE_UNAVAILABLE`, không trả 200 rỗng. Lỗi bất ngờ trả 500/`INTERNAL_ERROR`.                                 |
| Field response dùng ở Hub                                                 | `id` khớp `majorId`, `name` hiển thị, `type=Major`; không cần `status`/`created_at`.                                 |
| Major đóng sau khi Hub tải options                                        | API cơ hội trả 400/`INVALID_FILTER`; giao diện cho người dùng xóa filter, không âm thầm bỏ.                          |

Backend tests cho route Major nằm tại `backend/test/categories.test.mjs`. Các ca route/query/error dùng fake Prisma delegate; ca lọc trạng thái và sắp xếp collation có thể chạy qua Prisma trên MySQL tạm riêng bằng `TEST_CATEGORIES_DATABASE_URL`. Test thật chỉ chạy nếu biến này trỏ tới database loopback có tên bắt đầu `unihub_categories_test` và database chưa có category; test không xóa dữ liệu sẵn có.

## 8. Contract Skill và Admin categories — đã được leader duyệt, chưa triển khai

### `GET /api/categories?type=Skill`

Student-only; cần access JWT hợp lệ. Guest → 401 `UNAUTHORIZED`, Admin → 403 `FORBIDDEN`. Chỉ nhận đúng một query `type=Skill`; không có body, tìm kiếm hoặc phân trang. Thiếu/lặp/sai `type`, `status` hoặc query lạ → 400 `INVALID_QUERY`. Đọc `categories` với predicate `type=Skill AND status=Active`, sort `name ASC, category_id ASC` theo collation MySQL hiện có.

```json
{ "items": [{ "id": 31, "name": "TypeScript", "type": "Skill" }] }
```

Không có Skill Active → 200 `{"items":[]}`. DB không sẵn sàng → 503 `SERVICE_UNAVAILABLE`; lỗi bất ngờ → 500 `INTERNAL_ERROR`. Không trả trạng thái Closed, dữ liệu hồ sơ hoặc thông tin quản trị. API này cung cấp options cho Student profile, không thay thế Admin API.

### Admin category management

Tất cả route yêu cầu `requireAuth` rồi `requireRole('Admin')`; Guest → 401 `UNAUTHORIZED`, Student → 403 `FORBIDDEN`. Không endpoint nào hard-delete. Body/query thừa hoặc lặp bị từ chối. Tên được trim, không rỗng, tối đa 100 Unicode code point và duy nhất trong cùng type theo collation hiện tại. `reason` tùy chọn theo UC-13; nếu có thì không quá 500 ký tự và lưu riêng, không cắt. Không có tìm kiếm hoặc phân trang.

| Method/path                              | Request                                                                                                                     | Success response                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/admin/categories?type=Major`   | Chỉ query `type=Major`; không body/query khác. Trả Major Active và Closed.                                                  | 200 `{"items":[{"id":12,"name":"Kỹ thuật phần mềm","type":"Major","status":"Active"}]}`; sort `name ASC, category_id ASC`. |
| `GET /api/admin/categories?type=Skill`   | Chỉ query `type=Skill`; không body/query khác. Trả Skill Active và Closed.                                                  | 200 `{"items":[{"id":31,"name":"TypeScript","type":"Skill","status":"Active"}]}`; sort `name ASC, category_id ASC`.        |
| `POST /api/admin/categories`             | JSON `{"type":"Major","name":"Kỹ thuật phần mềm","reason":null}`; `reason` có thể bỏ qua/null; không nhận ID hoặc `status`. | 201 `{"category":{"id":12,"name":"Kỹ thuật phần mềm","type":"Major","status":"Active"}}`; trạng thái luôn Active.          |
| `PATCH /api/admin/categories/:id`        | ID số nguyên dương; JSON `{"name":"Tên mới","reason":null}`; rename Active hoặc Closed, không đổi type/status.              | 200 `{"changed":true,"category":{"id":12,"name":"Tên mới","type":"Major","status":"Active"}}`.                             |
| `PATCH /api/admin/categories/:id/status` | ID số nguyên dương; JSON `{"status":"Closed","reason":null}`; status chỉ `Active` hoặc `Closed`.                            | 200 `{"changed":true,"category":{"id":12,"name":"Kỹ thuật phần mềm","type":"Major","status":"Closed"}}`.                   |

Lỗi chung: path ID sai → 400 `INVALID_ID`; query sai → 400 `INVALID_QUERY`; JSON sai cú pháp → 400 `INVALID_JSON`; body sai shape/field thừa → 400 `INVALID_REQUEST`; field thiếu hoặc giá trị không hợp lệ → 400 `VALIDATION_ERROR` với `fieldErrors` tùy chọn; ID không tồn tại → 404 `NOT_FOUND`; tên trùng → 409 `DUPLICATE_CATEGORY`; đóng Active cuối cùng của type → 409 `LAST_ACTIVE_CATEGORY`; DB lỗi → 503 `SERVICE_UNAVAILABLE`; lỗi bất ngờ → 500 `INTERNAL_ERROR`. Đổi tên/trạng thái thành chính giá trị hiện có trả 200 `changed:false`, không ghi audit.

Mỗi mutation có đúng một INSERT `activity_logs` cùng transaction: `CREATE_CATEGORY`, `RENAME_CATEGORY`, `CLOSE_CATEGORY`, `REOPEN_CATEGORY`; target là Category, actor lấy từ JWT, old/new payload theo [activity log contract](activity-logs-contract.md), `reason` ở cột riêng nếu có. Bất kỳ lỗi log nào rollback thay đổi danh mục. DB UNIQUE `(type,name)`, CHECK type/status và FK là ràng buộc cấu trúc; backend kiểm tra quyền, type, tên, lifecycle và audit. Để tránh hai request đồng thời đóng mục Active cuối cùng, backend khóa/serialize thay đổi status theo type và kiểm tra lại invariant trong transaction.

### Hồ sơ và liên kết Closed

GET hồ sơ trả Major/Skill Closed hiện đã liên kết cùng trạng thái. Options chỉ chứa Active. PUT được phép gửi lại Closed ID nếu đó chính là liên kết hiện tại của user, nhằm giữ nguyên liên kết; không được gắn Closed ID mới. Khi replace danh sách Skill, bỏ ID hiện tại đồng nghĩa xóa liên kết đó. Lựa chọn mới phải Active tại thời điểm ghi. Chi tiết request/response ở [profile contract](profile-api-contract.md).

**Ma trận kiểm thử:** quyền Skill, Active-only, query lạ/lặp, response rỗng so với lỗi DB, type isolation; Admin CRUD body/query/path, duplicate theo collation, trim/length boundaries, no-op không audit, không hard-delete, Last Active và race đồng thời, payload/độ dài audit, rollback mutation+log. Contract đã duyệt; chưa có Skill/Admin routes trên `main`.

## 9. Ngoài phạm vi API Major

TV1 triển khai và merge endpoint Major `GET /api/categories?type=Major` qua PR #13; TV3 tiếp quản và tái sử dụng `backend/src/modules/categories`. Frontend consumer có trên `main` sau PR #12. Luồng Public Hub đã được kiểm tra end-to-end; xem [báo cáo tích hợp](opportunities-integration-test.md). Skill options, Admin CRUD và profile Closed policy đã được leader duyệt nhưng chưa triển khai. Xem [team-workflow.md](team-workflow.md).

## 10. Trạng thái triển khai và kết quả kiểm tra

Backend route dùng Prisma Client dùng chung. Kiểm thử tích hợp ngày 27/10/2026 áp dụng migration lên MySQL 8.4.13 tạm riêng và xác nhận Public Hub gọi API danh mục/cơ hội thật qua Express. Root `npm test`: frontend 25 pass; backend 28 pass; tổng 53 pass, 0 fail, 0 skip. Chromium ở 1280/1920 px: 78 kiểm tra pass; trường hợp danh mục rỗng và mất kết nối được thử với database/API thật. Chi tiết, giới hạn và bằng chứng screenshot nằm trong [báo cáo tích hợp](opportunities-integration-test.md). Không dùng database nhóm hoặc dữ liệu thật.
