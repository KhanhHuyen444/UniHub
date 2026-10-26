# Dự thảo hợp đồng API — Hub cơ hội → Chi tiết cơ hội

> **Trạng thái: contract cơ hội đã thống nhất, API chưa triển khai.** Nhóm đã duyệt deadline metadata/unknown, xử lý `majorId` Closed, phân trang, thứ tự và phần Major của API categories cho Hub. Phần Skill và xử lý hồ sơ có danh mục Closed trong [categories-api-contract.md](categories-api-contract.md) vẫn là dự thảo chờ TV2/TV3 thống nhất. Nhóm vẫn cần xác định frame chi tiết public trước khi dựng frontend chi tiết.

## 1. Phạm vi và nguồn

Tài liệu này ghi hợp đồng đọc danh sách cơ hội, tìm kiếm/lọc/phân trang và đọc chi tiết. Không bao gồm API/UI nghiệp vụ, Admin tạo/duyệt/từ chối, xác thực, cơ hội dành cho bạn, thuật toán gợi ý, seed hay thu thập dữ liệu. Metadata deadline được bổ sung riêng cho `opportunities` bằng migration mới đã merge vào `main` qua PR #8. Theo xác nhận của nhóm, database phát triển của leader có hai cột metadata; trạng thái database của thành viên khác chưa được xác nhận. Chưa triển khai endpoint API hay giao diện nghiệp vụ.

| Nguồn đã đọc                                 | Phần dùng trong dự thảo                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHƯƠNG 3.pdf` đính kèm                      | FR-02.1/02.2; UC-01/02; BR-01.1–01.8 và BR-02.1–02.4; luồng BPMN 3.2.2.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `CHƯƠNG 4.pdf` đính kèm                      | Sitemap §4.1.1; `opportunities` §4.3.2.3; `categories` §4.3.2.2; `opportunity_majors`, `opportunity_skills`, `opportunity_years` và các quan hệ tại §4.3.2.9–12.                                                                                                                                                                                                                                                                                                            |
| Handoff Figma trong `docs/shared-ui-design/` | Frame [36:39 — Hub cơ hội-V2](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=36-39) cho tìm kiếm/lọc và danh sách; frame [171:2628 — Chi tiết một tin HỌC BỔNG](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=171-2628) chỉ tham khảo tên/nội dung trường. Frame chi tiết ở khu vực kiểm duyệt Admin, không được coi là thiết kế public detail; controls/evidence được dẫn trong [handoff README](shared-ui-design/README.md). |
| Tài liệu repository                          | [Quy ước API](api-conventions.md), [sitemap/kiến trúc](architecture.md), [schema database](database-schema.md), [lộ trình](development-roadmap.md), [quy trình nhóm](team-workflow.md), [dự thảo categories](categories-api-contract.md), `backend/prisma/schema.prisma` và `frontend/src/lib/api.ts`.                                                                                                                                                                      |

Sitemap ghi `/opportunities` và `/opportunities/:id` là route công khai cho Guest và Student. Router frontend hiện chưa mount hai route nghiệp vụ; API client `apiRequest` đã có nhưng chưa có endpoint cơ hội.

## 2. Đối chiếu nghiệp vụ

| Yêu cầu                                | Nguồn                                                                                    | Quy tắc/đề xuất trong hợp đồng                                                                                                                                                                                                                                                                                              | Điểm chưa chốt                                                                                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ai xem danh sách và chi tiết           | Chương 3 FR-02.1, UC-01/02, BR-01.5, BR-02.4; Chương 4 sitemap §4.1.1                    | **Đã có căn cứ:** Guest và Student cùng đọc công khai, không cần đăng nhập. Endpoint không xác thực; gửi kèm phiên Admin cũng không làm lộ thêm dữ liệu.                                                                                                                                                                    | Không có quyền khác cho API đọc công khai trong phạm vi này.                                                                                                                                    |
| Loại tin được đưa vào Hub              | Chương 3 UC-01, BR-01.2, BR-02.1; Chương 4 §4.3.2.3                                      | **Đã có căn cứ:** chỉ `Thực tập`, `Việc làm`, `Học bổng`. `Bài viết định hướng` thuộc Lộ trình kỹ năng/định hướng, không thuộc Hub cơ hội.                                                                                                                                                                                  | Không có.                                                                                                                                                                                       |
| Trạng thái duyệt và quyền xem chi tiết | Chương 3 BR-01.1, UC-01; Chương 4 `opportunities.status`                                 | **Đã có căn cứ:** chỉ `Approved` được công khai. `Pending`/`Rejected` không xuất hiện trong danh sách và không được đọc qua endpoint chi tiết. Chi tiết không tồn tại và chi tiết không công khai cùng trả 404 để tránh tiết lộ trạng thái duyệt.                                                                           | Không có.                                                                                                                                                                                       |
| Ý nghĩa `is_verified`                  | Chương 3 FR-02.3, UC-01, BR-01.3; Chương 4 `opportunities.is_verified`                   | **Đã có căn cứ:** duyệt và cấp nhãn Verified là hai lựa chọn khác nhau. `Approved` không đồng nghĩa `is_verified=true`; trả boolean riêng, chỉ hiện huy hiệu khi true.                                                                                                                                                      | Không có.                                                                                                                                                                                       |
| Hết hạn, ngày không có giờ và NULL     | Chương 3 UC-01/BR-01.4; FR-03.2 mô tả riêng điều kiện gợi ý; quyết định nhóm đã duyệt    | **Đã duyệt:** date-only hết hạn từ 00:00 ngày kế tiếp theo `Asia/Ho_Chi_Minh` (`2026-11-05T17:00:00Z` cho ngày nguồn 05/11/2026), khi `now >= cutoff`; UI giữ ngày nguồn. Nguồn có giờ giữ instant và timezone nguồn; theo BR-01.4 hết hạn khi timestamp `< now`. Legacy unknown không hiện ngày/nhãn còn hạn hoặc hết hạn. | Schema/migration mới thêm ngày nguồn và timezone; dữ liệu cũ giữ metadata NULL, không suy đoán từ timestamp. Chỉ bổ sung cho bảng `opportunities`; xem §7. Không suy ra quy tắc recommendation. |
| Tìm kiếm và lọc                        | Chương 3 UC-02, BR-02.1–02.4; frame Figma 36:39                                          | **Đã có căn cứ:** keyword khớp tiêu đề, đơn vị đăng hoặc kỹ năng yêu cầu; lọc chuyên ngành, loại cơ hội, hình thức làm việc; các tiêu chí kết hợp AND, các trường keyword kết hợp OR. Keyword không phân biệt hoa/thường.                                                                                                   | Dự thảo quy định giới hạn độ dài, chuẩn hóa khoảng trắng và xử lý URL stale ở §4.                                                                                                               |
| Danh mục Active/Closed và liên kết cũ  | Chương 3 BR-02.3; Chương 4 `categories.status` và các bảng nối; quyết định nhóm đã duyệt | **Đã duyệt:** filter options chỉ Major `Active`; liên kết Major/Skill đã gắn vẫn trả tên kể cả khi danh mục `Closed`; keyword tìm theo Skill đã gắn kể cả Closed. URL chứa `majorId` Closed trả 400/`INVALID_FILTER`; frontend cho xóa bộ lọc, không tự bỏ điều kiện.                                                       | Phần Major của API categories cho Hub đã được duyệt; Skill và xử lý hồ sơ có danh mục Closed vẫn chờ TV2/TV3. Chi tiết trong [categories-api-contract.md](categories-api-contract.md).          |
| Phạm vi bài viết định hướng            | Chương 3 BR-01.2; Chương 4 §4.3.2.3                                                      | **Đã có căn cứ:** cùng lưu trong bảng `opportunities` nhưng không thuộc hai endpoint Hub này; không trả bài định hướng như cơ hội.                                                                                                                                                                                          | Contract API `/roadmaps` thuộc phạm vi khác.                                                                                                                                                    |
| Nguồn và thao tác mở `source_url`      | Chương 3 UC-01, BR-01.6; Chương 4 `source_url` nullable                                  | **Đã có căn cứ:** trả URL khi có; UI chỉ hiện thao tác xem nguồn nếu có URL. Không dùng API làm redirect hoặc tự tải trang nguồn. `publisher` (đơn vị đăng) không đồng nghĩa với website nguồn.                                                                                                                             | Chương 4 cho phép `source_url` NULL; vì vậy Approved không đảm bảo mọi tin có liên kết nguồn. Chưa có tên nguồn riêng ngoài publisher/URL.                                                      |
| Năm học liên quan                      | Chương 4 `opportunity_years`; nhóm đã xác nhận cách hiển thị khi không có liên kết       | **Đã xác nhận:** API trả mảng năm học; nếu không có liên kết thì `[]` và UI ẩn mục. Không suy ra rằng tin áp dụng cho mọi năm, không áp dụng quy tắc năm học vào lọc Hub hoặc gợi ý.                                                                                                                                        | Ý nghĩa của các năm đã gắn theo từng use case cần được giữ theo tài liệu nghiệp vụ tương ứng.                                                                                                   |

## 3. Endpoint danh sách

### `GET /api/opportunities`

**Contract:** đã thống nhất; endpoint chưa triển khai. **Truy cập:** công khai, không yêu cầu Google/JWT. Thành công trả HTTP 200 và `application/json` theo envelope `items`/`meta`.

Không truyền bộ lọc là hợp lệ cho UC-01 và trả feed mặc định. UC-02 yêu cầu có ít nhất một điều kiện khi người dùng bấm Tìm kiếm; nếu form rỗng, frontend hiển thị lời nhắc và không gửi request. Cùng một endpoint không thể phân biệt “mở feed” và “bấm tìm kiếm rỗng” chỉ từ GET.

| Query        | Kiểu/giới hạn đã thống nhất                                                  | Ý nghĩa                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`          | Chuỗi UTF-8, tối đa 100 code point; sau trim rỗng được xem như không truyền. | Tìm trong `title`, `publisher` và tên Skill thuộc `opportunity_skills`. Các trường này OR với nhau. Dùng collation đã chọn `utf8mb4_0900_as_ci`: không phân biệt hoa/thường, vẫn phân biệt dấu; chuẩn hóa Unicode NFC, trim hai đầu, không tự bỏ dấu hoặc đổi nội dung giữa các từ. Ký tự `%`, `_`, `\\` được tìm như ký tự thường, không thành wildcard SQL. |
| `majorId`    | Số nguyên dương trong miền `INT` có dấu.                                     | Chỉ khớp tin có liên kết tới đúng Major đang Active. Các Major trong một tin không nhân bản item.                                                                                                                                                                                                                                                             |
| `type`       | Một giá trị: `Thực tập`, `Việc làm`, `Học bổng`.                             | Lọc đúng loại. Không nhận `Bài viết định hướng` hoặc giá trị khác.                                                                                                                                                                                                                                                                                            |
| `workFormat` | Một giá trị: `Online`, `Offline`, `Hybrid`.                                  | Lọc đúng hình thức. NULL không khớp giá trị nào.                                                                                                                                                                                                                                                                                                              |
| `page`       | Số nguyên từ 1 đến 1,000,000; mặc định `1`.                                  | Trang theo offset; giới hạn đã được nhóm duyệt cho contract cơ hội.                                                                                                                                                                                                                                                                                           |
| `pageSize`   | Số nguyên từ 1 đến 100; mặc định `20`.                                       | Số item/trang; giá trị riêng của contract cơ hội, không mặc nhiên áp dụng cho mọi API.                                                                                                                                                                                                                                                                        |

Các bộ lọc `majorId`, `type`, `workFormat` kết hợp với nhau theo **AND**. Nhóm keyword là một điều kiện OR riêng, kết hợp với từng filter bằng **AND**. Không hỗ trợ nhiều giá trị lặp cho một tham số; không hỗ trợ `sort` query vì UC-01 đã định nghĩa thứ tự cố định. Tham số lặp hoặc query parameter không hỗ trợ trả 400/`INVALID_QUERY`.

**Validation đã duyệt:** phân tích số nghiêm ngặt, không chấp nhận số âm, số thập phân, chuỗi rỗng, giá trị thừa hay `NaN`; từ chối tham số lặp thay vì âm thầm lấy giá trị đầu/cuối. `pageSize` ngoài 1–100, `page` ngoài giới hạn, `type`/`workFormat` không hỗ trợ hoặc `q` quá dài trả 400/`INVALID_QUERY`. Một `majorId` không còn hợp lệ, gồm Major Closed, trả 400/`INVALID_FILTER`.

**Điều kiện dữ liệu:** mọi kết quả phải có `status = Approved` và thuộc ba loại cơ hội công khai. Không điều kiện nào từ query có thể nới tập trạng thái/loại này. Keyword kỹ năng tra qua liên kết Skill đã gắn, bao gồm liên kết tới category Closed theo quyết định nhóm. Filter chuyên ngành chỉ nhận Major Active.

**Sắp xếp đã duyệt:** nhóm theo thứ tự **còn hạn → không có hạn (`deadline: null`) → unknown → hết hạn**. Trong nhóm còn hạn, sắp `instant ASC`, rồi `item_id ASC`; nhóm không có hạn sắp `item_id ASC`; nhóm unknown sắp `item_id ASC`; nhóm hết hạn sắp `instant ASC`, rồi `item_id ASC`. Date-only hết hạn khi `evaluatedAt >= instant` tại cutoff ngày kế tiếp; nguồn có giờ hết hạn theo BR-01.4 khi `instant < evaluatedAt` (bằng nhau chưa hết hạn). Unknown không được xếp thành còn hạn/hết hạn từ timestamp cũ. Chụp một `evaluatedAt` UTC cho cả phân loại và sắp xếp trong response.

**Phân trang và total đã duyệt:** offset-based, `total` là số cơ hội phân biệt sau mọi điều kiện; `totalPages = ceil(total / pageSize)`, bằng `0` khi `total = 0`. Nếu `page > totalPages`, trả 200, `items: []`, giữ page đã yêu cầu trong meta và trả total thực tế; không trả 404. Concurrent insert/delete có thể làm item đổi trang giữa các request; đây là giới hạn của offset pagination. Dùng cùng predicate cho count và select.

Không join nhiều bảng N-N trong một truy vấn phẳng rồi paginate/count trên các hàng nhân bản. Dùng `EXISTS` cho lọc major/skill, hoặc select ID phân biệt trước rồi nạp quan hệ theo batch. Bảo đảm mỗi `item_id` xuất hiện đúng một lần trong `items`; `total` cũng đếm item duy nhất.

#### Response 200 — ví dụ minh họa (dữ liệu hư cấu, không phải seed)

```json
{
  "items": [
    {
      "id": 41,
      "type": "Thực tập",
      "title": "Cơ hội minh họa",
      "publisher": "Đơn vị minh họa",
      "workFormat": "Hybrid",
      "location": "Thành phố Hồ Chí Minh",
      "deadline": {
        "precision": "date",
        "date": "2026-11-05",
        "sourceTimeZone": null,
        "instant": "2026-11-05T17:00:00Z",
        "state": "open"
      },
      "isVerified": true
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "evaluatedAt": "2026-10-26T03:00:00Z"
  }
}
```

`deadline` là `null` khi DB không có hạn nộp; trường hợp này khác deadline object `precision: "unknown"`. Response mục tiêu dùng `precision: "date" | "datetime" | "unknown"`, `date` là ngày hiển thị theo `Asia/Ho_Chi_Minh` hoặc `null` khi chưa xác minh, `instant` là UTC, `sourceTimeZone` giữ timezone nguồn cho datetime, và `state: "open" | "expired" | "unknown"` do backend xác định tại `meta.evaluatedAt`. Với nguồn date-only, `instant` là cutoff loại trừ 00:00 ngày kế tiếp theo `Asia/Ho_Chi_Minh`; ví dụ ngày nguồn `2026-11-05` có cutoff `2026-11-05T17:00:00Z`, hết hạn khi `evaluatedAt >= instant`, UI vẫn hiện ngày nguồn `2026-11-05`. Với nguồn có giờ, `instant` giữ đúng thời điểm sau chuyển UTC, `sourceTimeZone` giữ zone/offset gốc, UI hiển thị ngày theo `Asia/Ho_Chi_Minh`, và theo BR-01.4 hết hạn khi `instant < evaluatedAt` (bằng nhau chưa hết hạn). Với legacy unknown, giữ `instant` hiện có nhưng trả `date: null`, `sourceTimeZone: null`, `state: "unknown"`; không suy đoán precision hoặc trạng thái từ timestamp. UI dùng `state` backend thay vì đồng hồ client. Quy tắc NULL trong recommendation nằm ngoài hợp đồng này.

Ví dụ response deadline của một bản ghi cũ có UTC timestamp `2026-11-05T17:00:00Z` nhưng không còn thông tin nguồn: `{"precision":"unknown","date":null,"sourceTimeZone":null,"instant":"2026-11-05T17:00:00Z","state":"unknown"}`. Timestamp này vẫn giữ nguyên trong response; ví dụ không khẳng định đó là cutoff date-only hay giờ cụ thể.

**Biểu diễn và giới hạn:** schema/migration mới lưu cutoff hoặc instant trong `opportunities.deadline` UTC cùng metadata ngày nguồn/timezone. Date-only 05/11 và timestamp chính xác 06/11 00:00 `Asia/Ho_Chi_Minh` cùng có thể có `deadline = 2026-11-05T17:00:00Z`, nhưng `deadline_source_date`/`deadline_source_timezone` phân biệt ngày hiển thị và precision. Legacy có deadline nhưng cả hai metadata NULL, nên không thể phân loại expiry; trả unknown. CHECK chỉ ràng buộc tổ hợp cột, backend xác thực timezone và tính deadline theo nguồn.

Ví dụ nguồn có giờ cụ thể `05/11/2026 12:00 Asia/Ho_Chi_Minh`: response mục tiêu là `precision: "datetime"`, `date: "2026-11-05"`, `sourceTimeZone: "Asia/Ho_Chi_Minh"`, `instant: "2026-11-05T05:00:00Z"`; hết hạn theo BR-01.4 khi `instant < evaluatedAt`. Nếu nguồn ghi giờ nhưng không có timezone, phải xác minh timezone trước khi đổi sang UTC.

`location` nullable và chỉ hiển thị khi `workFormat` là `Offline`/`Hybrid`; API không trả địa điểm cho `Online` dù dữ liệu không hợp lệ có giá trị. `publisher` thuộc schema nullable nhưng CHECK của Chương 4 buộc không NULL cho ba loại tin này; UI vẫn nên không render nếu dữ liệu lỗi/rỗng. `isVerified` luôn là boolean; chỉ hiển thị badge khi true. `type` chỉ thuộc ba giá trị trên.

#### Lỗi danh sách

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "Tham số tìm kiếm hoặc lọc không hợp lệ."
  }
}
```

| HTTP | `error.code`          | Khi dùng                                                                           |
| ---- | --------------------- | ---------------------------------------------------------------------------------- |
| 400  | `INVALID_QUERY`       | Query sai kiểu/giới hạn, lặp, hoặc không hỗ trợ.                                   |
| 400  | `INVALID_FILTER`      | `majorId` không phải Major Active, gồm trường hợp URL trỏ tới Major Closed.        |
| 503  | `SERVICE_UNAVAILABLE` | Backend nhận diện database không sẵn sàng; thông báo chung, không lộ MySQL/Prisma. |
| 500  | `INTERNAL_ERROR`      | Lỗi bất ngờ; envelope hiện có, không lộ stack/SQL/configuration.                   |

Mọi lỗi giữ envelope `error.code`/`error.message` của `api-conventions.md`; chưa đề xuất `fieldErrors`.

### Phụ thuộc danh mục bộ lọc — TV3 sở hữu hợp đồng chung

BR-02.3 yêu cầu bộ chọn chuyên ngành chỉ gồm Major Active. Nhóm đã duyệt phần Major của API đọc dùng chung do TV3 sở hữu: `GET /api/categories?type=Major`, không có query `status`, response `{ "items": [{ "id": 12, "name": "Kỹ thuật phần mềm", "type": "Major" }] }`. Endpoint opportunities tiêu thụ API này; implementation chưa có. Phần Skill và hồ sơ Closed còn chờ TV2/TV3, xem [categories-api-contract.md](categories-api-contract.md). Không dùng endpoint danh mục cho `type`/`workFormat` của cơ hội vì miền giá trị đó cố định trong Chương 4.

### URL có `majorId` đã đóng — quyết định đã duyệt

Trả 400/`INVALID_FILTER` với thông báo trung tính “Bộ lọc chuyên ngành không còn hợp lệ.” Frontend cho người dùng xóa bộ lọc; API/frontend không âm thầm bỏ điều kiện hoặc mở rộng kết quả. Các liên kết Major/Skill đã gắn với cơ hội tiếp tục xuất hiện ở detail/search theo quyết định nhóm trước đó.

## 4. Endpoint chi tiết

### `GET /api/opportunities/:id`

**Contract:** đã thống nhất; endpoint chưa triển khai. Công khai, không yêu cầu xác thực. `id` phải là số nguyên thập phân dương trong miền MySQL `INT` có dấu. ID sai cấu trúc/ngoài miền trả 400/`INVALID_ID`; ID hợp lệ không tồn tại, Pending, Rejected, bài định hướng hoặc không thuộc tập công khai trả cùng HTTP 404/`NOT_FOUND`.

Truy vấn chỉ trả `Approved` thuộc ba loại công khai. Không phân biệt 404 do tài nguyên không tồn tại hay không đủ điều kiện công khai. Không dùng 403 cho tin riêng tư vì endpoint này không phải khu vực yêu cầu quyền đăng nhập.

#### Response 200 — ví dụ minh họa (dữ liệu hư cấu, không phải seed)

```json
{
  "item": {
    "id": 41,
    "type": "Học bổng",
    "title": "Cơ hội học bổng minh họa",
    "publisher": "Đơn vị minh họa",
    "descriptionText": "## Giới thiệu học bổng\nThông tin...",
    "requirementsText": "## Đối tượng và điều kiện xét tuyển\nSinh viên...",
    "workFormat": null,
    "location": null,
    "deadline": {
      "precision": "date",
      "date": "2026-11-05",
      "sourceTimeZone": null,
      "instant": "2026-11-05T17:00:00Z",
      "state": "open"
    },
    "isVerified": true,
    "sourceUrl": "https://example.invalid/scholarship",
    "majors": [{ "id": 12, "name": "Kỹ thuật phần mềm" }],
    "skills": [{ "id": 33, "name": "Phân tích dữ liệu" }],
    "eligibleAcademicYears": [2, 3]
  },
  "meta": { "evaluatedAt": "2026-10-26T03:00:00Z" }
}
```

`descriptionText`/`requirementsText` là text thường, nullable, có thể chứa tiêu đề mục `## Tên mục` theo BR-01.8; không trả HTML. UI sắp xếp và đặt tiêu đề mục theo `type` và bảng quy tắc BR-01.8. Khi thiếu trường/mục thì bỏ khỏi giao diện. `majors`, `skills`, `eligibleAcademicYears` luôn là mảng; không có liên kết trả `[]`. Major/Skill Closed vẫn được trả nếu đã gắn với item, theo quyết định nhóm. `eligibleAcademicYears: []` chỉ nói không có liên kết năm học; UI ẩn mục, không diễn giải thành “mọi năm”. Để ổn định thứ tự mảng, đề xuất sort `majors`/`skills` theo tên rồi ID, `eligibleAcademicYears` tăng dần.

`sourceUrl` là chuỗi URL hoặc `null`. UI chỉ hiển thị “Xem nguồn tin” nếu có URL hợp lệ; mở nguồn trực tiếp bằng liên kết ngoài, không qua proxy/redirect của UniHub. Đề xuất backend chỉ cho phép scheme `https:`/`http:` khi xác thực dữ liệu đã duyệt; không fetch URL phía server. Cách mở cửa sổ ngoài nên dùng `rel="noopener noreferrer"` nếu mở tab mới.

### Trường API và ánh xạ schema

Tên API được chọn riêng cho hợp đồng JSON (camelCase/ý nghĩa giao diện), không mặc nhiên kế thừa tên cột. Bảng này là ánh xạ tường minh về schema hiện tại, không phải thay đổi mô hình.

| Trường API                                              | Kiểu/nullability                            | Nguồn/diễn giải                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                    | integer                                     | `opportunities.item_id`.                                                                                                                                                                                                   |
| `type`, `title`                                         | string                                      | `opportunity_type`, `title`; type giới hạn ba loại công khai.                                                                                                                                                              |
| `publisher`                                             | string theo dữ liệu hợp lệ; schema nullable | `publisher`; ba loại công khai không NULL theo CHECK, nhưng UI cần phòng dữ liệu rỗng/sai.                                                                                                                                 |
| `descriptionText`, `requirementsText`                   | string \| null                              | `description`, `requirements`; text thuần, nullable, không trả markup HTML.                                                                                                                                                |
| `workFormat`                                            | `Online` \| `Offline` \| `Hybrid` \| null   | `work_format`; giá trị lấy từ CHECK hiện tại.                                                                                                                                                                              |
| `location`                                              | string \| null                              | `location`; trả `null`/ẩn với Online theo BR-01.7.                                                                                                                                                                         |
| `deadline`                                              | object \| null                              | Object gồm precision, ngày hiển thị, timezone nguồn, instant UTC và state tại `evaluatedAt`; schema/migration metadata mới lưu đủ cho bản ghi mới. Bản ghi cũ giữ metadata NULL và trả unknown; không deadline trả `null`. |
| `isVerified`                                            | boolean                                     | `is_verified`; độc lập với trạng thái duyệt.                                                                                                                                                                               |
| `sourceUrl`                                             | string URL \| null                          | `source_url`; chỉ mở trực tiếp khi hợp lệ, không tự lấy URL từ publisher.                                                                                                                                                  |
| `majors`                                                | `{id, name}[]`                              | `opportunity_majors` nối `categories` type Major. Closed vẫn có thể xuất hiện nếu đã liên kết.                                                                                                                             |
| `skills`                                                | `{id, name}[]`                              | `opportunity_skills` nối `categories` type Skill. Closed vẫn có thể xuất hiện/tìm kiếm nếu đã liên kết.                                                                                                                    |
| `eligibleAcademicYears`                                 | `(1\|2\|3\|4)[]`                            | `opportunity_years.academic_year`; không có link trả `[]`.                                                                                                                                                                 |
| `status`, `reviewedBy`, `reviewedAt`                    | Không trả                                   | `opportunities.status`, `reviewed_by`, `reviewed_at` là dữ liệu quy trình nội bộ; public query chỉ xác nhận eligibility, không cần lộ.                                                                                     |
| Email/role/tài khoản Admin, lý do từ chối, activity log | Không trả                                   | Không thuộc UI công khai; không serialize quan hệ reviewer hoặc dữ liệu quản trị.                                                                                                                                          |
| `created_at`                                            | Không trả                                   | Không có yêu cầu giao diện trong UC-01/02.                                                                                                                                                                                 |

`source_url` và `deadline` nullable không làm mất quy tắc schema. API không đổi `null` thành chuỗi rỗng. Không dùng status để làm nhãn; không đặt `isVerified=true` suy ra từ Approved. API không sửa dữ liệu hoặc lọc danh mục đã đóng khỏi các liên kết.

#### Lỗi chi tiết

| HTTP | `error.code`          | Khi dùng                                                        |
| ---- | --------------------- | --------------------------------------------------------------- |
| 400  | `INVALID_ID`          | ID không phải số nguyên dương hợp lệ.                           |
| 404  | `NOT_FOUND`           | Không tồn tại hoặc không được phép công khai; cùng một message. |
| 503  | `SERVICE_UNAVAILABLE` | Database không sẵn sàng, message chung.                         |
| 500  | `INTERNAL_ERROR`      | Lỗi bất ngờ, không trả stack/SQL/configuration.                 |

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Không tìm thấy cơ hội."
  }
}
```

## 5. Ánh xạ frontend khi triển khai sau

Đây là hướng dẫn contract, không thêm code trong nhiệm vụ này.

| Trạng thái/luồng                    | Hành vi dự kiến                                                                                                                                                                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route                               | Sitemap: `/opportunities` và `/opportunities/:id`, Guest/Student. Router hiện chỉ có route kỹ thuật/preview; TV1 mount route nghiệp vụ sau khi contract được duyệt.                                                                                 |
| API client                          | Dùng `apiRequest('/api/opportunities', { query: URLSearchParams, signal })` và tương tự cho `/:id`; giữ URL tương đối `/api`, không gọi MySQL trực tiếp từ frontend. Xác thực shape JSON ở feature vì client chung không validate schema nghiệp vụ. |
| Query state                         | Đồng bộ từ khóa, `majorId`, `type`, `workFormat`, `page`, `pageSize` vào query string; submit filter đặt page về 1. URL có thể chia sẻ và browser Back khôi phục danh sách/kết quả.                                                                 |
| Danh sách loading/success           | Loading state chung; khi có items render trang. Không dùng dữ liệu preview giả để biểu diễn response API.                                                                                                                                           |
| Danh sách empty                     | Không query/filter và total 0: thông báo “Hiện chưa có cơ hội nào được công bố”. Có điều kiện tìm/lọc nhưng total 0: “Không tìm thấy cơ hội phù hợp”. Backend vẫn trả 200 với `items: []`.                                                          |
| Trang vượt phạm vi                  | API trả `items: []` và total thực khi page > totalPages. Frontend phân biệt trang ngoài phạm vi với không có kết quả; không hiện empty state khi `total > 0`.                                                                                       |
| Lỗi danh sách                       | Hiển thị lỗi tải và nút thử lại; tách lỗi mạng/5xx khỏi empty. Query invalid hiển thị lỗi filter cụ thể, không báo “không có cơ hội”.                                                                                                               |
| Chi tiết loading/success/not found  | Loading; khi có `item`, render chi tiết; 404 hiển thị trạng thái không tìm thấy/không công khai, không hỏi đăng nhập.                                                                                                                               |
| Đầu vào thiết kế chi tiết công khai | Frame `171:2628` trong handoff là chi tiết ở khu vực kiểm duyệt Admin; hiện chưa xác nhận frame chi tiết cơ hội công khai. Bổ sung/định danh frame public trước khi dựng frontend chi tiết; không lấy frame Admin làm thiết kế thay thế.            |
| Deadline unknown                    | Giữ nguyên thứ tự từ API; không hiển thị ngày nguồn hoặc nhãn còn hạn/hết hạn cho `precision/state: "unknown"`. Đây là deadline chưa xác minh, khác `deadline: null` là không có hạn. Không tự chuyển timestamp thành ngày.                         |
| Back từ chi tiết                    | Link vào chi tiết giữ lại URL danh sách nguồn. Nút Quay lại dùng navigation history khi có nguồn trong app; truy cập trực tiếp fallback về `/opportunities` không query. Không tự dựng danh sách query khác.                                        |
| Request stale                       | Dùng `AbortSignal` của `apiRequest` khi query đổi/unmount; bỏ qua kết quả cũ để không ghi đè trang mới. Abort không hiển thị lỗi backend.                                                                                                           |
| Nguồn                               | Chỉ render link nếu `sourceUrl` có giá trị và hợp lệ. Không giả một đường dẫn khi NULL; mở URL nguồn thật do backend trả.                                                                                                                           |

Student/Admin preview hiện tại không phải xác thực. Route guard frontend về sau chỉ phục vụ điều hướng; hai endpoint công khai vẫn kiểm tra `Approved` và type tại server.

## 6. Ma trận kiểm thử dự kiến (chưa viết test)

| Ca                                                        | Kỳ vọng                                                                                                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Có dữ liệu Approved thuộc ba loại / không có dữ liệu      | 200 có items; hoặc 200 rỗng và frontend phân biệt empty feed với không tìm thấy theo điều kiện URL.                                                                        |
| Pending/Rejected hoặc bài viết định hướng                 | Không xuất hiện trong list; detail trả cùng 404 với ID không có.                                                                                                           |
| Guest/Student và request không có token                   | Cùng kết quả public; không mở dữ liệu nội bộ.                                                                                                                              |
| Keyword trúng title/publisher/skill, kết hợp nhiều filter | OR trong keyword fields; AND giữa keyword và từng filter; hoa/thường không ảnh hưởng; dấu tiếng Việt giữ nguyên.                                                           |
| Major/Skill liên kết nhiều-nhiều, category Closed         | Mỗi cơ hội chỉ một lần và count chính xác; Closed liên kết vẫn trả/tìm kiếm; danh sách option chỉ Major Active; URL `majorId` Closed trả 400/`INVALID_FILTER`.             |
| Type/workFormat, tham số lặp/sai/không hỗ trợ             | Giá trị hợp lệ lọc chính xác; query sai trả 400; `Bài viết định hướng` không được dùng làm type Hub.                                                                       |
| Deadline date-only 05/11/2026                             | Cutoff exclusive là 06/11 00:00 `Asia/Ho_Chi_Minh` = `2026-11-05T17:00:00Z`; ngay trước cutoff còn hạn, tại và sau cutoff hết hạn; UI giữ ngày nguồn 05/11/2026.           |
| Deadline có giờ cụ thể                                    | Giữ đúng instant nguồn sau đổi UTC và source timezone; theo BR-01.4 hết hạn khi `deadline < now`, bằng nhau chưa nhỏ hơn. UI hiển thị theo `Asia/Ho_Chi_Minh`.             |
| NULL deadline                                             | API trả `null`, UI không hiện hạn; đây là nhóm không có hạn, khác `unknown`; không tự suy ra quy tắc recommendation.                                                       |
| Bản ghi cũ có deadline nhưng thiếu metadata               | Không suy đoán precision/date/timezone/state từ timestamp; API giữ instant nhưng trả precision/state `unknown`, date/sourceTimeZone null; UI không hiện ngày/nhãn hết hạn. |
| Trùng instant date-only và datetime midnight              | Hai nguồn có thể cùng UTC instant nhưng khác ngày hiển thị/state boundary; metadata phân biệt chúng, không suy ra loại từ instant.                                         |
| Thứ tự deadline hỗn hợp                                   | Còn hạn → NULL → unknown → hết hạn; unknown theo `item_id ASC`; open/expired theo instant ASC rồi `item_id ASC`; lặp truy vấn cùng dữ liệu cho thứ tự ổn định.             |
| Deadline trùng nhau và phân trang                         | Tie-break `item_id ASC` ổn định; không trùng item/thiếu total do N-N; `page > totalPages` xử lý như contract được duyệt.                                                   |
| Năm học liên quan                                         | Trả đầy đủ các năm liên kết 1–4; không link trả `[]`; UI ẩn mục, không tự coi là mọi năm hoặc dùng cho gợi ý.                                                              |
| ID/query sai hoặc ID không tồn tại                        | ID hỏng 400; hợp lệ nhưng không có/không công khai cùng 404; tham số query xấu 400, không lộ SQL.                                                                          |
| `sourceUrl` NULL/hợp lệ/URL không hợp lệ                  | NULL không render link; link hợp lệ mở đúng nguồn; không tạo redirect/fetch từ server, không cho scheme nguy hiểm.                                                         |
| Database/backend lỗi                                      | 503/500 theo contract, message chung; UI hiện error/retry, không nhầm với empty và không lộ config/stack.                                                                  |
| Không lộ trường nội bộ                                    | Response không có reviewer, trạng thái nội bộ, email/role, log, lý do từ chối hoặc dữ liệu tài khoản.                                                                      |
| Tìm kiếm liên tục và Back                                 | Request cũ bị hủy/bỏ; Back khôi phục URL/list filter; direct detail có fallback an toàn.                                                                                   |

## 7. Metadata deadline đã được duyệt

Nhóm duyệt bổ sung hai cột metadata vào riêng bảng `opportunities` bằng migration mới. Initial migration và các giá trị `deadline` đang có được giữ nguyên. Mục tiêu là phân biệt nguồn chỉ ghi ngày với nguồn có giờ, giữ ngày nguồn và giữ múi giờ nguồn khi có giờ. Hợp đồng hết hạn đã xác nhận:

- Date-only `2026-11-05`: cutoff loại trừ là 00:00 ngày 06/11 theo `Asia/Ho_Chi_Minh`, tức `2026-11-05T17:00:00Z`; hết hạn khi `now >= cutoff`; UI hiển thị ngày nguồn 05/11/2026.
- Có giờ cụ thể: giữ exact instant UTC cùng timezone/offset nguồn; theo BR-01.4 hết hạn khi `instant < now`; tại đúng bằng nhau chưa nhỏ hơn.
- `deadline` NULL vẫn không có deadline. Không suy luận quy tắc recommendation từ contract này.

### Trường và ràng buộc nhất quán

| Trường                                   | Trạng thái/kiểu đã duyệt                        | Ý nghĩa                                                                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `opportunities.deadline`                 | Đã có: MySQL `DATETIME(0)`; quy ước giá trị UTC | Date-only lưu cutoff UTC ngày kế tiếp; datetime lưu instant nguồn đã đổi UTC. DATETIME không tự lưu timezone.                                                                                    |
| `opportunities.deadline_source_date`     | **Đã duyệt:** `DATE NULL`                       | Ngày gốc chỉ được điền khi nguồn date-only; đây cũng là marker `precision=date`. NULL với datetime/legacy.                                                                                       |
| `opportunities.deadline_source_timezone` | **Đã duyệt:** `VARCHAR(64) NULL`                | Timezone nguồn cho datetime cụ thể, lưu tên IANA hoặc offset tường minh; backend bắt buộc và xác thực với bản ghi datetime mới. NULL với date-only vì cutoff dùng chính sách `Asia/Ho_Chi_Minh`. |

Không thêm cột `precision` riêng: `deadline_source_date` đánh dấu date-only; `deadline_source_timezone` đánh dấu datetime mới; deadline có giá trị nhưng cả hai metadata NULL là legacy chưa rõ precision.

Ràng buộc SQL duy nhất mới, `chk_opportunities_deadline_metadata`, cho phép `deadline IS NULL` chỉ khi cả metadata đều NULL; nếu deadline có giá trị thì cho phép date-only (ngày có, timezone NULL), datetime (ngày NULL, timezone có) hoặc legacy unknown (cả hai NULL). Constraint từ chối cả hai metadata cùng có giá trị. Nó chỉ kiểm tra tính nhất quán cấu trúc; không xác thực tên timezone, không tính cutoff và không kiểm tra `deadline` có khớp ngày/instant nguồn hay không. Backend phải xác thực timezone hợp lệ, xác minh timezone nguồn trước khi chuẩn hóa giờ sang UTC và tính cutoff date-only đúng quy tắc.

Tương đương logic CHECK: `((deadline IS NOT NULL OR (deadline_source_date IS NULL AND deadline_source_timezone IS NULL)) AND (deadline_source_date IS NULL OR deadline_source_timezone IS NULL))`. MySQL 8.4 thực thi CHECK này. Không thêm FK/index hoặc thay đổi bảng khác.

| Nguồn                               | Giá trị `deadline` UTC     | `deadline_source_date` | `deadline_source_timezone` | Ý nghĩa/API mục tiêu                                                                                                |
| ----------------------------------- | -------------------------- | ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Chỉ ghi ngày 05/11/2026             | `2026-11-05 17:00:00`      | `2026-11-05`           | `NULL`                     | `precision=date`; cutoff `2026-11-05T17:00:00Z`; UI hiện `05/11/2026`; hết hạn khi `now >= cutoff`.                 |
| 06/11/2026 00:00 `Asia/Ho_Chi_Minh` | `2026-11-05 17:00:00`      | `NULL`                 | `Asia/Ho_Chi_Minh`         | `precision=datetime`; cùng UTC instant với date-only 05/11 nhưng UI hiện `06/11/2026`; hết hạn khi `instant < now`. |
| Bản ghi cũ chỉ có `deadline`        | Giữ nguyên giá trị đang có | `NULL`                 | `NULL`                     | `precision/state=unknown`; không bịa ngày nguồn/timezone hoặc nhãn còn hạn/hết hạn.                                 |

Response API mục tiêu do đó có `deadline: null` hoặc `{ precision, date, sourceTimeZone, instant, state }`. `date` lấy từ `deadline_source_date` với date-only; với datetime là ngày hiển thị theo Asia/Ho_Chi_Minh. Date-only có `sourceTimeZone: null` vì timezone là chính sách cutoff; datetime trả nguyên timezone/offset nguồn đã lưu. Legacy có `precision: "unknown"`, `date: null`, `sourceTimeZone: null`, giữ `instant` UTC đang có và `state: "unknown"`. UI không hiển thị ngày nguồn hoặc nhãn còn hạn/hết hạn cho legacy unknown. Đây là quyết định đã duyệt.

### Tác động tài liệu/mô hình

| Thành phần    | Thay đổi / đối chiếu                                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chương 4      | Cần cập nhật §4.3.2.3: thêm hai cột ở bảng `opportunities`, kiểu/nullability, các tổ hợp metadata hợp lệ/legacy unknown, cutoff date-only, lưu timezone nguồn cho datetime và ranh giới CHECK/backend. **PDF chưa được sửa.** |
| Prisma schema | `Opportunity` thêm `deadline_source_date DateTime? @db.Date` và `deadline_source_timezone String? @db.VarChar(64)`. Hai cột, không đổi model/bảng module khác.                                                                |
| Migration     | Migration mới duy nhất thêm hai cột nullable và `chk_opportunities_deadline_metadata` vào `opportunities`; không cập nhật deadline hiện có, không sửa initial migration.                                                      |
| API           | `deadline` trả `precision`, `date`, `sourceTimeZone`, `instant`, `state`; legacy unknown giữ instant nhưng ngày/timezone/state là unknown/null theo contract. API nghiệp vụ chưa triển khai.                                  |

### Bản ghi cũ

Khi migration chạy trên database đã có initial migration, hai cột mới của bản ghi cũ mặc định NULL; giữ nguyên `deadline`. Không backfill precision/date/timezone từ giờ timestamp, kể cả 00:00 hoặc 23:59:59. Bản ghi có deadline và metadata NULL trả unknown; frontend không hiển thị ngày nguồn hoặc nhãn còn hạn/hết hạn. Theo nhóm xác nhận, hai cột metadata có trên database phát triển leader; trạng thái database của thành viên khác chưa xác nhận.

## 8. Trạng thái quyết định và phụ thuộc còn lại

### Quyết định đã được nhóm duyệt

- Deadline metadata/constraint: hai cột nullable ở §7; bản ghi cũ giữ NULL, không backfill; unknown không hiện ngày hoặc nhãn còn hạn/hết hạn.
- Major Closed: URL `majorId` Closed trả 400/`INVALID_FILTER`; frontend cho xóa filter và không âm thầm bỏ điều kiện. Các liên kết Major/Skill cũ vẫn giữ.
- Phân trang: page mặc định 1, pageSize mặc định 20/tối đa 100, page tối đa 1,000,000; query sai/lặp trả 400; page vượt total trả 200 với `items: []` và total thực.
- Thứ tự: còn hạn → không có hạn → unknown → hết hạn; open/expired theo instant ASC rồi `item_id ASC`; NULL/unknown theo `item_id ASC`.

### Hai phụ thuộc chưa hoàn thành

| Phụ thuộc             | Việc cần làm                                                                                                                                   | Tác động                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Skill/profile Closed  | TV2/TV3 thống nhất phần Skill và hành vi hồ sơ có danh mục Closed trong [categories-api-contract.md](categories-api-contract.md).              | Không chặn Major filter đã có contract; chặn phần profile/Skill liên quan.  |
| Frame chi tiết public | Xác định frame Figma chi tiết cơ hội Guest/Student và các state cần thiết. Frame `171:2628` hiện được xác nhận thuộc khu vực kiểm duyệt Admin. | Chặn dựng frontend chi tiết theo thiết kế; không chặn contract/API backend. |

API công khai chỉ có dữ liệu Approved sau quy trình duyệt. Không seed Approved để bỏ qua quy trình; dữ liệu hư cấu chỉ dùng riêng cho test và phải ghi nhãn.

## 9. Phụ thuộc triển khai

- Backend thuộc `backend/src/modules/opportunities`; frontend thuộc `frontend/src/features/opportunities`, cùng làm bởi TV1 theo [team-workflow](team-workflow.md).
- Contract Major Active dùng chung của TV3 đã được nhóm duyệt; TV1 và TV3 có thể triển khai provider/consumer song song. Endpoint chưa chạy. Skill và hồ sơ Closed vẫn là dự thảo chờ TV2/TV3.
- `opportunities` có 17 cột trong schema/migration đã merge vào `main`; Chương 4 hiện mô tả 15 cột và cần cập nhật §4.3.2.3. Xem [schema Prisma và migration](database-schema.md).
- API và UI nghiệp vụ vẫn chưa triển khai. Frame public detail cần được xác định trước khi dựng trang chi tiết. Theo nhóm, database phát triển leader đã có hai cột metadata deadline; thành viên khác cần xác minh database của mình. Runtime chỉ backend kết nối MySQL.

### Ranh giới database và backend

| Database đã bảo đảm                                                                                                                                                                                                     | Backend vẫn phải bảo đảm                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PK/FK, NOT NULL/kiểu/độ dài, khóa ghép chống link trùng; CHECK status thuộc Pending/Approved/Rejected, work_format thuộc Online/Offline/Hybrid khi có giá trị, publisher không NULL với loại không phải bài định hướng. | Chỉ lọc Approved và ba loại công khai; xác thực đúng Major/Skill type qua FK categories; chỉ đưa Major Active vào filter; giữ Closed link; kiểm tra URL nguồn trước duyệt; xác thực miền `opportunity_type`, điều kiện `location` theo `workFormat`; tìm/filter/sort, phân trang không trùng item, chuẩn hóa deadline và loại dữ liệu quản trị khỏi response. |
| CHECK `chk_opportunities_deadline_metadata` chỉ bảo đảm NULL/metadata được tổ hợp nhất quán.                                                                                                                            | Xác thực timezone hợp lệ và có thể diễn giải; xác minh timezone nguồn trước khi đổi giờ cụ thể sang UTC; tính cutoff date-only ngày kế tiếp theo `Asia/Ho_Chi_Minh`; không phân loại legacy unknown từ timestamp.                                                                                                                                             |

CHECK/FK không quyết định quyền xem công khai, không xác thực category type/status, không bảo đảm URL an toàn hoặc quy tắc hiển thị. Xem [đối chiếu database/backend](database-schema.md#6-ranh-giới-database-và-backend).
