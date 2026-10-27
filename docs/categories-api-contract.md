# Hợp đồng API đọc danh mục dùng chung

> **Major đã được nhóm duyệt và endpoint đã được triển khai trên `feat/categories-major-api`; PR #13 đang chờ review/merge vào `main`.** Frontend consumer Major đã được merge vào `main` qua PR #12. Phần Skill và xử lý hồ sơ Closed vẫn là dự thảo chờ TV2/TV3 thống nhất. Quyết định về liên kết Major/Skill Closed trong cơ hội đã được nhóm chốt riêng và không mở rộng sang hồ sơ.

## 1. Mục tiêu, phạm vi và nguồn

TV3 sở hữu module `categories` và cung cấp một API đọc danh mục dùng chung. TV1 tiêu thụ danh sách Major Active cho bộ lọc Hub cơ hội. Không tạo endpoint danh mục trong `opportunities`. Tài liệu và nhánh `feat/categories-major-api` hiện thực hóa phần đọc Major đã duyệt; không bao gồm API Admin tạo/sửa/đóng/mở danh mục, Skill, frontend implementation, auth implementation, seed hoặc thay đổi schema/migration/GRANT.

Nguồn đã đối chiếu:

| Nguồn                                                                                                                                                  | Phần có liên quan                                                                 | Điều nguồn đó xác nhận                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHƯƠNG 3.pdf` (tệp đính kèm)                                                                                                                          | FR-01.2; UC-05; FR-02.2, BR-02.3–02.4; FR-03.1, UC-03, BR-03.2–03.3; SYS-02/UC-13 | Hồ sơ Student chọn Major và Skill Active; Hub và lộ trình liệt kê Major Active; Guest/Student dùng Hub và lộ trình công khai; Admin quản lý hai loại danh mục. |
| `CHƯƠNG 4.pdf` (tệp đính kèm)                                                                                                                          | Sitemap §4.1.1; ERD/quan hệ §4.2; bảng `categories` §4.3.2.2                      | Major và Skill dùng chung bảng, có `type`, `name`, `status`; Admin đóng/mở chứ không xóa cứng.                                                                 |
| `PCCV-UNIHUB - Trang tính4.pdf` (tệp đính kèm)                                                                                                         | Bối cảnh phân công dự án                                                          | Được xem cùng yêu cầu phân công hiện tại; ranh giới TV1/TV2/TV3 trong hợp đồng này theo yêu cầu mới nhất và [team-workflow.md](team-workflow.md).              |
| [Chương trình database](database-schema.md), `backend/prisma/schema.prisma`, migration initial                                                         | Model `Category`, CHECK, UNIQUE và collation MySQL                                | Cấu trúc hiện thực của `categories`; không phải quy tắc phân quyền hay lựa chọn dữ liệu API.                                                                   |
| [Handoff Figma](shared-ui-design/README.md), frame [36:39 — Hub cơ hội-V2](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=36-39) | Select bộ lọc Hub và option chuyên ngành minh họa                                 | Có control chọn chuyên ngành; không xác nhận endpoint, tên field, quyền, cách xử lý Closed hoặc nội dung production.                                           |

Phân công TV1–TV5 dùng trong tài liệu theo yêu cầu hiện tại: TV1 làm Hub/chi tiết; TV2 làm auth, hồ sơ/tài khoản; TV3 làm lộ trình, gợi ý và danh mục. Đây là vai trò nhóm đã phân công, không phải dữ liệu suy ra từ Figma.

## 2. Điều đã có căn cứ và quyết định đã chốt

**Căn cứ trong tài liệu:** Chương 3 BR-02.3 yêu cầu lựa chọn chuyên ngành của Hub lấy từ D6 và chỉ gồm Active; BR-02.4 cho phép Guest và Student dùng tìm kiếm/lọc không cần đăng nhập. UC-03/BR-03.3 cũng chọn Major Active cho trang lộ trình công khai. UC-05 dùng danh sách Major và Skill Active trong biểu mẫu hồ sơ Student. Chương 4 §4.3.2.2 đặt hai loại trong bảng `categories` và yêu cầu đóng/mở, không xóa cứng.

**Quyết định nhóm đã duyệt:** bộ chọn Hub dùng `GET /api/categories?type=Major`, công khai và chỉ trả Major Active; response có `id`, `name`, `type`, sắp xếp `name ASC, category_id ASC`. `type` bắt buộc; không nhận `status` hoặc query không hỗ trợ. Không có kết quả trả 200 với `items: []`; chưa có phân trang/tìm kiếm. Major/Skill Closed đã liên kết với cơ hội vẫn giữ liên kết và tên; tìm kiếm theo Skill đã gắn vẫn tính cả Skill Closed. Hub gửi `majorId` Closed nhận 400/`INVALID_FILTER`; frontend cho người dùng xóa bộ lọc, không tự bỏ điều kiện. Quyết định trong Hub không đặt quy tắc hiển thị Closed cho hồ sơ.

**Còn là dự thảo:** API đọc Skill và quyền truy cập; xử lý hồ sơ đang tham chiếu Major/Skill Closed; chi tiết auth error code của phần Skill. Các mục này cần TV2/TV3 thống nhất. Không lấy quy tắc Major của Hub làm bằng chứng rằng Guest được đọc danh sách Skill.

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

Không tạo endpoint danh mục trong module `opportunities`; TV1 dùng API chung do TV3 cung cấp. `type=Skill` chưa thuộc phần contract đã duyệt.

### Query lỗi và lỗi server

Giữ envelope `error.code`/`error.message` theo [api-conventions.md](api-conventions.md). Thông báo lỗi không chứa SQL, Prisma, cấu hình, stack trace hoặc dữ liệu nhạy cảm.

| Tình huống Major                                                                  | HTTP / `error.code`         | Hành vi                                                              |
| --------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------- |
| Thiếu/lặp/sai `type`, `type` khác `Major`, query `status` hoặc query không hỗ trợ | 400 / `INVALID_QUERY`       | Không bỏ qua tham số lỗi hoặc tự lấy giá trị đầu/cuối.               |
| Database không sẵn sàng                                                           | 503 / `SERVICE_UNAVAILABLE` | Lỗi chung; không giả thành kết quả rỗng, không lộ chi tiết database. |
| Lỗi bất ngờ                                                                       | 500 / `INTERNAL_ERROR`      | Lỗi chung; không lộ stack trace/configuration.                       |

`INVALID_QUERY`, `SERVICE_UNAVAILABLE` và `INTERNAL_ERROR` theo quy ước API repository. Query `type=Skill` chưa thuộc contract đã duyệt.

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

| API                         | Schema / database        | Trả?  | Ghi chú                                                                             |
| --------------------------- | ------------------------ | ----- | ----------------------------------------------------------------------------------- |
| `id`                        | `categories.category_id` | Có    | Số nguyên; client gửi `id` Major qua `majorId` cho API cơ hội.                      |
| `name`                      | `categories.name`        | Có    | Tên hiện tại của danh mục.                                                          |
| `type`                      | `categories.type`        | Có    | Giá trị luôn là `Major` trong contract đã duyệt. Contract Skill còn chờ thống nhất. |
| điều kiện `status = Active` | `categories.status`      | Không | Server lọc; không trả status vì endpoint chỉ cung cấp lựa chọn hiện hành.           |
| `created_at`                | `categories.created_at`  | Không | Không cần cho option, không phải metadata quản trị.                                 |

Major API không trả thông tin quản trị hoặc Closed. Đổi tên danh mục có hiệu lực trên liên kết theo Chương 4; các response nội dung/detail phải lấy tên hiện hành. Quy tắc đó không biến endpoint options thành nguồn dữ liệu lịch sử.

## 5. Lọc và thứ tự theo database hiện có

`Category` ánh xạ bảng `categories` có 5 cột: `category_id`, `type`, `name`, `status`, `created_at`; UNIQUE `(type, name)`. CHECK giới hạn `type` vào `Major`/`Skill` và `status` vào `Active`/`Closed`. Đây là ràng buộc database, không phải authorization.

Database hiện dùng `utf8mb4_0900_as_ci`: so sánh/sắp xếp tên không phân biệt hoa thường nhưng phân biệt dấu. `UNIQUE(type, name)` vì vậy không nhận hai tên cùng loại chỉ khác hoa/thường; khác dấu vẫn có thể là hai tên khác nhau. Với Major, nhóm đã duyệt sắp xếp theo collation cột hiện tại, `name ASC, category_id ASC`. Khóa ID phụ bảo đảm thứ tự xác định khi tên so sánh bằng nhau theo collation; không đổi collation hay thêm trường chuẩn hóa. Hành vi sort của danh sách Skill còn thuộc dự thảo.

Backend phải xác thực query Major chính xác trước truy vấn. Không dựa vào collation MySQL để chấp nhận `major` như `Major`. CHECK `type/status` không tự lọc response và không thay thế kiểm tra query.

## 6. Phối hợp module

| Nhu cầu                                                         | Bên cung cấp                            | Bên sử dụng                          | Hợp đồng/phụ thuộc                                                                                                                                                    |
| --------------------------------------------------------------- | --------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Major Active cho bộ lọc Hub cơ hội                              | TV3 — `categories`                      | TV1 — `opportunities`                | Contract Major đã được nhóm duyệt; backend endpoint và tests có trên `feat/categories-major-api` (PR #13, chờ merge); frontend consumer đã có trên `main` qua PR #12. |
| Major Active cho lựa chọn chuyên ngành trong lộ trình công khai | TV3 — `categories`/`guidance`           | TV3 — `guidance`                     | Chương 3 UC-03/BR-03.3 yêu cầu Major Active; không tạo endpoint category thứ hai trong guidance.                                                                      |
| Major/Skill Active cho hồ sơ                                    | TV3 — `categories`                      | TV2 — `profile`                      | UC-05 nêu cả Major và Skill Active; cần TV2/TV3 thống nhất quyền `type=Skill`, và xử lý giá trị hồ sơ cũ đã Closed.                                                   |
| Skill trong lộ trình/chi tiết cơ hội                            | TV3 — `guidance`, TV1 — `opportunities` | Guest/Student đọc nội dung tương ứng | Lấy skill đã gắn từ response nội dung; API options Active không được dùng để xóa/ẩn link Closed. Closed link trong cơ hội tiếp tục theo quyết định nhóm đã chốt.      |
| Quản trị danh mục                                               | TV3 — `categories`                      | Admin                                | Tạo/sửa/đóng/mở/đọc Closed thuộc contract Admin riêng; không thêm vào API đọc options này.                                                                            |

Frontend consumer hiện trên `main` sau PR #12 gọi `GET /api/categories?type=Major` và parse `{items:[{id,name,type}]}`, tương thích với endpoint trên `feat/categories-major-api` đang được review tại PR #13. Hai phần chưa có kiểm thử end-to-end trực tiếp; trước khi endpoint Major được merge, backend chạy từ `main` có thể trả 404. Frontend không giả định option luôn còn Active. Nếu category bị đóng sau khi tải option, API cơ hội trả 400/`INVALID_FILTER`; UI báo bộ lọc không còn hợp lệ và cho người dùng xóa. Lỗi tải categories có error/retry state riêng, không hiển thị như `items: []`.
Đối với bản ghi liên kết Closed, tách rõ ba việc: endpoint options chỉ trả Active; endpoint nội dung có thể trả liên kết đã tồn tại theo quy tắc của module; endpoint Admin quản lý Closed ngoài phạm vi. Không suy ra rằng mọi module phải xóa hoặc ẩn liên kết cũ.

## 7. Ma trận kiểm thử

| Ca kiểm thử                                                               | Kỳ vọng                                                                                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Guest/Student gọi `type=Major`, có Major Active                           | 200; chỉ Major Active, đúng shape và thứ tự.                                                                         |
| Major không có kết quả Active                                             | 200, `items: []`; không coi đây là lỗi.                                                                              |
| Gọi `type=Major` khi có Skill Active/Closed                               | Không có Skill trong response.                                                                                       |
| Có Major Closed                                                           | Không xuất hiện trong options dù có request từ Admin; không hỗ trợ cách lấy Closed qua endpoint này.                 |
| Student gọi `type=Skill`                                                  | Chưa có contract được duyệt; chờ TV2/TV3 chốt endpoint/role/response.                                                |
| Guest gọi `type=Skill`; Admin gọi route options                           | Quyền chưa được chốt; không suy ra việc Guest/Admin được đọc danh sách Skill từ contract Major.                      |
| Tên giống nhau về hoa/thường hoặc khác dấu                                | Thứ tự tuân collation MySQL đã cấu hình; tie-break `category_id ASC`. Unique cùng loại chặn tên chỉ khác hoa/thường. |
| `type` thiếu, lặp, sai case hoặc không hỗ trợ; có query `status`/query lạ | 400/`INVALID_QUERY`; không âm thầm chuẩn hóa/bỏ tham số.                                                             |
| Database lỗi                                                              | 503/`SERVICE_UNAVAILABLE`, không trả 200 rỗng. Lỗi bất ngờ trả 500/`INTERNAL_ERROR`.                                 |
| Field response dùng ở Hub                                                 | `id` khớp `majorId`, `name` hiển thị, `type=Major`; không cần `status`/`created_at`.                                 |
| Major đóng sau khi Hub tải options                                        | API cơ hội trả 400/`INVALID_FILTER`; giao diện cho người dùng xóa filter, không âm thầm bỏ.                          |

Backend tests cho route Major nằm tại `backend/test/categories.test.mjs`. Các ca route/query/error dùng fake Prisma delegate; ca lọc trạng thái và sắp xếp collation có thể chạy qua Prisma trên MySQL tạm riêng bằng `TEST_CATEGORIES_DATABASE_URL`. Test thật chỉ chạy nếu biến này trỏ tới database loopback có tên bắt đầu `unihub_categories_test` và database chưa có category; test không xóa dữ liệu sẵn có.

## 8. Phần còn dự thảo — chờ TV2/TV3 thống nhất

| Quyết định                        | Phương án để TV2/TV3 review                                                                                                                                            | Tác động                                                                                   | Có chặn triển khai không                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Đọc danh sách Skill               | Chốt consumer, role được đọc, có yêu cầu `type=Skill` hay endpoint dùng chung, và tập Active/Closed; đề xuất ban đầu là Student đọc Skill Active cho hồ sơ theo UC-05. | Ảnh hưởng TV2 profile và TV3 categories/guidance; không ảnh hưởng contract Major đã duyệt. | Chặn phần đọc Skill; không chặn Major Hub.           |
| Error code cho quyền Skill        | Nếu yêu cầu Student, thống nhất 401/403 và mã lỗi với TV2; tên mã chưa được contract auth xác nhận.                                                                    | Giữ lỗi auth nhất quán liên module.                                                        | Chỉ chặn `type=Skill`.                               |
| Hồ sơ có Major/Skill cũ đã Closed | Chốt giữ để hiển thị, yêu cầu đổi, hay chỉ cấm chọn lại; không áp quy tắc liên kết cơ hội sang hồ sơ.                                                                  | Ảnh hưởng đọc/cập nhật hồ sơ và recommendations.                                           | Chặn xử lý trọn luồng profile; không chặn Major Hub. |
| Pagination/search/order cho Skill | Contract Major đã chốt không phân trang/tìm kiếm và sort theo name/id; TV2/TV3 xác nhận có dùng cùng cách cho Skill hay cần khác.                                      | Nếu khác, cần shape/query/giới hạn riêng cho consumer Skill.                               | Chỉ chặn API/consumer Skill.                         |

## 9. Không triển khai trong nhiệm vụ này

Endpoint Major `GET /api/categories?type=Major` và backend tests đã được triển khai trên `feat/categories-major-api` (PR #13 đang chờ review/merge). Frontend consumer Major đã được merge vào `main` qua PR #12 và gửi đúng path/query/response shape. Chưa có kiểm thử tích hợp end-to-end trực tiếp giữa frontend và backend. API quản trị danh mục, Skill, auth, seed, schema/migration/GRANT hoặc dữ liệu danh mục thật vẫn ngoài phạm vi; không tuyên bố phần Skill/hồ sơ Closed đã được duyệt. TV3 sở hữu `backend/src/modules/categories`; xem [team-workflow.md](team-workflow.md).

## 10. Trạng thái triển khai và kết quả kiểm tra

Backend route dùng Prisma Client dùng chung. Ngày 27/10/2026, categories API được kiểm thử qua HTTP/Express và MySQL 8.4.13 tạm riêng: áp dụng migrations lên database test cô lập, xác nhận response rỗng, sau đó dùng fixtures tạm Major Active/Closed và Skill Active để kiểm tra filter, response và thứ tự theo collation. Container chỉ publish loopback, không gắn volume và được xóa sau test; không dùng database nhóm hoặc seed repository.

Kết quả root `npm test` trước PR #12: frontend 13 pass; backend 20 pass, 0 fail, 8 skip (các ca MySQL opportunities do thiếu `TEST_DATABASE_URL`); categories MySQL chạy và pass với `TEST_CATEGORIES_DATABASE_URL`. Sau PR #12, frontend suite có 25 pass theo lần kiểm tra ở nhánh `feat/opportunities-frontend`; test consumer Major dùng response giả, chưa phải end-to-end. Các kết quả này phân biệt kiểm thử API/database với kiểm thử consumer frontend.
