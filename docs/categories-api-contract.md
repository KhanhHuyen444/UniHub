# Dự thảo hợp đồng API đọc danh mục dùng chung

> **Trạng thái: dự thảo, chưa được TV1/TV3 duyệt (phần Skill cần TV2 phối hợp) và chưa triển khai.** Các quyết định về `Major`/`Skill`, quyền đọc `Skill`, query và thứ tự dưới đây là đề xuất để review. Các quy tắc đã được nhóm chốt riêng về Major Closed và liên kết cũ được ghi là quyết định đã duyệt.

## 1. Mục tiêu, phạm vi và nguồn

TV3 sở hữu module `categories` và cung cấp một API đọc danh mục dùng chung. TV1 tiêu thụ danh sách Major Active cho bộ lọc Hub cơ hội. Không tạo endpoint danh mục trong `opportunities`. Tài liệu chỉ chốt hợp đồng đọc; không bao gồm API Admin tạo/sửa/đóng/mở danh mục, code backend/frontend, auth implementation, seed hoặc thay đổi schema/migration/GRANT.

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

**Quyết định nhóm đã duyệt trước:** bộ chọn Hub chỉ có Major Active; Major/Skill Closed đã liên kết với cơ hội vẫn giữ liên kết và tên; tìm kiếm theo Skill đã gắn vẫn tính cả Skill Closed. Hub gửi `majorId` Closed nhận 400/`INVALID_FILTER`; frontend cho người dùng xóa bộ lọc, không tự bỏ điều kiện. Quyết định này không tự đặt quy tắc hiển thị Closed cho hồ sơ hoặc module khác.

**Không phải quy tắc đã được duyệt:** endpoint, query `type`, quyền đọc danh sách Skill, status query, phân trang/tìm kiếm, response shape và thứ tự dưới đây đều là đề xuất cần TV1/TV3 review; phần Skill cần TV2 phối hợp vì ảnh hưởng hồ sơ.

## 3. Đề xuất endpoint

### `GET /api/categories?type=Major`

| Thuộc tính          | Đề xuất                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method/path         | `GET /api/categories`                                                                                                                                                                                                                                                                                                              |
| Query `type`        | Bắt buộc, xuất hiện đúng một lần; chỉ nhận chính xác `Major` hoặc `Skill`, không tự trim hoặc đổi hoa/thường. Thiếu, lặp hoặc giá trị khác trả 400/`INVALID_QUERY`.                                                                                                                                                                |
| Trạng thái          | Không nhận query `status`. Server luôn lọc `status = Active`; thêm `status=Active`, `status=Closed` hay bất kỳ tham số không hỗ trợ nào đều trả 400/`INVALID_QUERY`. Quyền/phiên Admin không làm thay đổi tập kết quả.                                                                                                             |
| `type=Major`        | Đọc công khai cho Guest và Student; không cần đăng nhập. Admin nếu gọi cùng endpoint cũng chỉ nhận Major Active như người dùng công khai.                                                                                                                                                                                          |
| `type=Skill`        | Đề xuất yêu cầu Student đã xác thực, vì UC-05 dùng Skill Active trong hồ sơ Student. Guest không có nhu cầu danh sách chọn Skill được xác nhận trong nguồn; kỹ năng hiển thị trong lộ trình công khai đi theo nội dung lộ trình. Admin đọc danh mục đóng hoặc chức năng quản trị nằm ngoài API này. Quy tắc này chờ TV2/TV3 duyệt. |
| Phân trang/tìm kiếm | Không có trong phiên bản đề xuất ban đầu. Chưa thấy yêu cầu hoặc số lượng danh mục chứng minh cần; nếu dữ liệu/đo hiệu năng cho thấy cần, review query và giới hạn riêng trước khi thêm.                                                                                                                                           |
| Thứ tự              | `name ASC`, sau đó `category_id ASC` để có thứ tự xác định. Xem §5 về collation.                                                                                                                                                                                                                                                   |

Tham số `type` bắt buộc để client chỉ lấy loại danh mục cần dùng, tránh lấy cả Major lẫn Skill rồi tự lọc ở frontend. `type=Major` là phần ưu tiên phục vụ Hub; `type=Skill` là phương án tích hợp cho hồ sơ Student, chưa phải cam kết Guest được truy cập danh sách Skill.

### Quyền và ranh giới truy cập

- API Major là API đọc công khai theo FR-02.4; Guest và Student nhận cùng một tập Major Active.
- Với API Skill, đề xuất yêu cầu Student vì nguồn gắn việc chọn Skill với hồ sơ Student (UC-05). Đề xuất mã lỗi là 401/`UNAUTHENTICATED` khi chưa có phiên Student hợp lệ và 403/`FORBIDDEN` khi phiên hợp lệ nhưng role không được phép. Tên mã lỗi xác thực cụ thể cần thống nhất với contract auth của TV2.
- Endpoint này không cung cấp cách xem Closed. `status` không phải query được hỗ trợ; bearer token hoặc role Admin không thể nới điều kiện Active. Admin list/search/đóng/mở danh mục phải thuộc contract quản trị riêng của TV3, ngoài phạm vi này.
- Backend phải tự áp dụng `type` và `status = Active`, không tin frontend hay query do client gửi. Quyền lọc danh sách không thay thế việc backend cơ hội kiểm tra lại `majorId` lúc nhận request.

### Query lỗi và HTTP lỗi

Giữ envelope `error.code`/`error.message` theo [api-conventions.md](api-conventions.md). Thông báo lỗi không chứa SQL, Prisma, cấu hình, stack trace hoặc dữ liệu nhạy cảm.

| Tình huống                                                                                                                    | HTTP / `error.code` đề xuất | Hành vi                                                                |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| Thiếu `type`; `type` lặp; sai chữ hoa/thường; giá trị không phải `Major`/`Skill`; query `status`, `page`, `q` hoặc tham số lạ | 400 / `INVALID_QUERY`       | Không bỏ qua tham số lỗi và không tự lấy giá trị đầu/cuối.             |
| `type=Skill` nhưng chưa có phiên đăng nhập                                                                                    | 401 / `UNAUTHENTICATED`     | Không truy vấn hoặc trả danh sách Skill. Mã cụ thể chờ TV2 thống nhất. |
| `type=Skill` với role không được phép                                                                                         | 403 / `FORBIDDEN`           | Không trả danh sách Skill. Mã cụ thể chờ TV2 thống nhất.               |
| Database không sẵn sàng                                                                                                       | 503 / `SERVICE_UNAVAILABLE` | Lỗi chung; không giả thành kết quả rỗng và không lộ chi tiết database. |
| Lỗi bất ngờ                                                                                                                   | 500 / `INTERNAL_ERROR`      | Lỗi chung; không lộ stack trace/configuration.                         |

Các mã 401/403 trên là đề xuất cho đến khi TV2 xác nhận convention auth. Mã 400/503/500 khớp với quy ước và hợp đồng API cơ hội hiện tại.

## 4. Response đề xuất

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

Nếu không có danh mục Active thì trả HTTP 200 với `{"items": []}`. Lỗi truy vấn/database không được biến thành `items: []`. Chương 4 yêu cầu luôn còn ít nhất một Active mỗi loại và kiểm tra ở tầng nghiệp vụ; đó không phải CHECK của database, nên response rỗng vẫn cần định nghĩa an toàn.

### Ánh xạ và trường trả về

| API                         | Schema / database        | Trả?  | Ghi chú                                                                             |
| --------------------------- | ------------------------ | ----- | ----------------------------------------------------------------------------------- |
| `id`                        | `categories.category_id` | Có    | Số nguyên; client gửi `id` Major qua `majorId` cho API cơ hội.                      |
| `name`                      | `categories.name`        | Có    | Tên hiện tại của danh mục.                                                          |
| `type`                      | `categories.type`        | Có    | `Major` hoặc `Skill`; giữ để caller kiểm tra loại và dùng chung một response shape. |
| điều kiện `status = Active` | `categories.status`      | Không | Server lọc; không trả status vì endpoint chỉ cung cấp lựa chọn hiện hành.           |
| `created_at`                | `categories.created_at`  | Không | Không cần cho option, không phải metadata quản trị.                                 |

API không trả thông tin quản trị hoặc Closed. Đổi tên danh mục có hiệu lực trên liên kết theo Chương 4; các response nội dung/detail phải lấy tên hiện hành. Quy tắc đó không biến endpoint options thành nguồn dữ liệu lịch sử.

## 5. Lọc và thứ tự theo database hiện có

`Category` ánh xạ bảng `categories` có 5 cột: `category_id`, `type`, `name`, `status`, `created_at`; UNIQUE `(type, name)`. CHECK giới hạn `type` vào `Major`/`Skill` và `status` vào `Active`/`Closed`. Đây là ràng buộc database, không phải authorization.

Database hiện dùng `utf8mb4_0900_as_ci`: so sánh/sắp xếp tên không phân biệt hoa thường nhưng phân biệt dấu. `UNIQUE(type, name)` vì vậy không nhận hai tên cùng loại chỉ khác hoa/thường; khác dấu vẫn có thể là hai tên khác nhau. Đề xuất sắp xếp bằng collation cột hiện tại, `name ASC, category_id ASC`. Khóa ID phụ bảo đảm thứ tự xác định khi tên so sánh bằng nhau theo collation; không tự đổi collation hay thêm trường chuẩn hóa.

Backend phải xác thực query `type` đúng chính tả/case trước truy vấn. Không dựa vào collation MySQL để chấp nhận `major` như `Major`. CHECK `type/status` không tự lọc response và không thay thế kiểm tra role/query.

## 6. Phối hợp module

| Nhu cầu                                                         | Bên cung cấp                            | Bên sử dụng                          | Hợp đồng/phụ thuộc                                                                                                                                               |
| --------------------------------------------------------------- | --------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Major Active cho bộ lọc Hub cơ hội                              | TV3 — `categories`                      | TV1 — `opportunities`                | API Major công khai, response `{id,name,type}`; Hub gửi `id` qua `majorId`. Chờ TV1/TV3 review dự thảo này.                                                      |
| Major Active cho lựa chọn chuyên ngành trong lộ trình công khai | TV3 — `categories`/`guidance`           | TV3 — `guidance`                     | Chương 3 UC-03/BR-03.3 yêu cầu Major Active; không tạo endpoint category thứ hai trong guidance.                                                                 |
| Major/Skill Active cho hồ sơ                                    | TV3 — `categories`                      | TV2 — `profile`                      | UC-05 nêu cả Major và Skill Active; cần TV2/TV3 thống nhất quyền `type=Skill`, và xử lý giá trị hồ sơ cũ đã Closed.                                              |
| Skill trong lộ trình/chi tiết cơ hội                            | TV3 — `guidance`, TV1 — `opportunities` | Guest/Student đọc nội dung tương ứng | Lấy skill đã gắn từ response nội dung; API options Active không được dùng để xóa/ẩn link Closed. Closed link trong cơ hội tiếp tục theo quyết định nhóm đã chốt. |
| Quản trị danh mục                                               | TV3 — `categories`                      | Admin                                | Tạo/sửa/đóng/mở/đọc Closed thuộc contract Admin riêng; không thêm vào API đọc options này.                                                                       |

TV1 và TV3 không cần đợi implementation của nhau sau khi hợp đồng Major được duyệt: TV3 có thể làm provider, TV1 làm consumer dựa trên cùng shape/error contract rồi tích hợp. Frontend không giả định option luôn còn Active. Nếu category bị đóng sau khi tải option, API cơ hội trả 400/`INVALID_FILTER`; UI báo bộ lọc không còn hợp lệ và cho người dùng xóa. Lỗi tải categories phải có error/retry state riêng, không hiển thị như `items: []`.

Đối với bản ghi liên kết Closed, tách rõ ba việc: endpoint options chỉ trả Active; endpoint nội dung có thể trả liên kết đã tồn tại theo quy tắc của module; endpoint Admin quản lý Closed ngoài phạm vi. Không suy ra rằng mọi module phải xóa hoặc ẩn liên kết cũ.

## 7. Ma trận kiểm thử dự kiến — chưa viết test

| Ca kiểm thử                                                               | Kỳ vọng                                                                                                              |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Guest/Student gọi `type=Major`, có Major Active                           | 200; chỉ Major Active, đúng shape và thứ tự.                                                                         |
| Major không có kết quả Active                                             | 200, `items: []`; không coi đây là lỗi.                                                                              |
| Gọi `type=Major` khi có Skill Active/Closed                               | Không có Skill trong response.                                                                                       |
| Có Major Closed                                                           | Không xuất hiện trong options dù có request từ Admin; không hỗ trợ cách lấy Closed qua endpoint này.                 |
| Student gọi `type=Skill`                                                  | Theo đề xuất, 200 và chỉ Skill Active; ca chờ TV2/TV3 duyệt quyền.                                                   |
| Guest gọi `type=Skill`; Admin gọi route options                           | Theo đề xuất 401/403; không trả danh sách Skill/Closed; chờ duyệt rule role.                                         |
| Tên giống nhau về hoa/thường hoặc khác dấu                                | Thứ tự tuân collation MySQL đã cấu hình; tie-break `category_id ASC`. Unique cùng loại chặn tên chỉ khác hoa/thường. |
| `type` thiếu, lặp, sai case hoặc không hỗ trợ; có query `status`/query lạ | 400/`INVALID_QUERY`; không âm thầm chuẩn hóa/bỏ tham số.                                                             |
| Database lỗi                                                              | 503/`SERVICE_UNAVAILABLE`, không trả 200 rỗng. Lỗi bất ngờ trả 500/`INTERNAL_ERROR`.                                 |
| Field response dùng ở Hub                                                 | `id` khớp `majorId`, `name` hiển thị, `type=Major`; không cần `status`/`created_at`.                                 |
| Major đóng sau khi Hub tải options                                        | API cơ hội trả 400/`INVALID_FILTER`; giao diện cho người dùng xóa filter, không âm thầm bỏ.                          |

## 8. Quyết định cần TV1/TV2/TV3 review

| Quyết định                        | Phương án đề xuất                                                                                                   | Tác động                                                                                          | Có chặn triển khai không                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Hợp đồng chung của TV1/TV3        | Dùng `GET /api/categories` do TV3 sở hữu; TV1 gọi qua API client chung, không tạo route trong opportunities.        | Chốt ownership, path và một nguồn option.                                                         | Có — chờ TV1/TV3 duyệt trước khi tích hợp.                            |
| `type` và quyền đọc               | Bắt buộc `type`; Major công khai Guest/Student; Skill chỉ Student theo UC-05.                                       | Hub/lộ trình công khai dùng Major; TV2 hồ sơ dùng Skill.                                          | Major chặn tích hợp cho đến khi duyệt; Skill chỉ chặn consumer Skill. |
| Active/Closed                     | Không nhận `status`; luôn lọc Active. Không có ngoại lệ theo bearer/Admin trên API options.                         | Không làm lộ Closed; link cũ được xử lý ở API nội dung; Admin API riêng.                          | Có — cần duyệt trước khi implement route chung.                       |
| Hồ sơ có Major/Skill cũ đã Closed | Chưa có căn cứ quy định giữ để hiển thị, bắt đổi hay chỉ cấm chọn lại; đề nghị TV2/TV3 chốt trong contract profile. | Có thể ảnh hưởng đọc/cập nhật hồ sơ và recommendations; không đổi quy tắc opportunities đã duyệt. | Chặn xử lý trọn luồng profile, không chặn Major Hub.                  |
| Phân trang/tìm kiếm               | Ban đầu không có; xem lại nếu TV3 cung cấp số lượng/quy mô hoặc đo hiệu năng chứng minh cần.                        | Giữ API selector đơn giản, không áp quy ước phân trang chung máy móc.                             | Không chặn bản đầu nếu nhóm duyệt phương án.                          |
| Thứ tự                            | `name ASC, category_id ASC` theo `utf8mb4_0900_as_ci`.                                                              | Thứ tự ổn định, nhất quán với UNIQUE/collation đang có.                                           | Cần duyệt cùng contract; không chặn độc lập phần UI.                  |
| Error code auth cho Skill         | 401/`UNAUTHENTICATED`, 403/`FORBIDDEN`; TV2 xác nhận tên code chung.                                                | Đảm bảo lỗi role nhất quán giữa modules.                                                          | Chỉ chặn `type=Skill`; Major công khai không phụ thuộc auth.          |

## 9. Không triển khai trong nhiệm vụ này

Chưa có endpoint categories chạy được, chưa sửa API client/UI, chưa có API quản trị danh mục, auth, seed, test code, schema/migration/GRANT hoặc dữ liệu danh mục thật. Hợp đồng này là tài liệu dự thảo; không tuyên bố TV1/TV2/TV3 đã duyệt. Sau review, có thể triển khai categories provider và Major filter consumer song song theo ownership ở [team-workflow.md](team-workflow.md).
