# Dự thảo hợp đồng API — Hub cơ hội → Chi tiết cơ hội

> **Trạng thái: Dự thảo chờ review.** Các endpoint dưới đây chưa được triển khai. Những nội dung ghi “Đã có căn cứ” lấy từ tài liệu nhóm; “Đề xuất kỹ thuật” cần review trước khi code; “Cần quyết định/review” chưa được coi là quy tắc đã phê duyệt.

## 1. Phạm vi và nguồn

Tài liệu này đề xuất hợp đồng đọc danh sách cơ hội, tìm kiếm/lọc/phân trang, đọc chi tiết và lấy chuyên ngành cho bộ lọc. Không bao gồm API/UI nghiệp vụ, Admin tạo/duyệt/từ chối, xác thực, cơ hội dành cho bạn, thuật toán gợi ý, seed hay thu thập dữ liệu. Không thay đổi schema, migration, CHECK, FK, GRANT hoặc công nghệ.

| Nguồn đã đọc                                 | Phần dùng trong dự thảo                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHƯƠNG 3.pdf` đính kèm                      | FR-02.1/02.2; UC-01/02; BR-01.1–01.8 và BR-02.1–02.4; luồng BPMN 3.2.2.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `CHƯƠNG 4.pdf` đính kèm                      | Sitemap §4.1.1; `opportunities` §4.3.2.3; `categories` §4.3.2.2; `opportunity_majors`, `opportunity_skills`, `opportunity_years` và các quan hệ tại §4.3.2.9–12.                                                                                                                                                                                                                                                                                                            |
| Handoff Figma trong `docs/shared-ui-design/` | Frame [36:39 — Hub cơ hội-V2](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=36-39) cho tìm kiếm/lọc và danh sách; frame [171:2628 — Chi tiết một tin HỌC BỔNG](https://www.figma.com/design/6lTZvLvJfeOhz6D8QltvMe/Untitled?node-id=171-2628) chỉ tham khảo tên/nội dung trường. Frame chi tiết ở khu vực kiểm duyệt Admin, không được coi là thiết kế public detail; controls/evidence được dẫn trong [handoff README](shared-ui-design/README.md). |
| Tài liệu repository                          | [Quy ước API](api-conventions.md), [sitemap/kiến trúc](architecture.md), [schema database](database-schema.md), [lộ trình](development-roadmap.md), [quy trình nhóm](team-workflow.md), `backend/prisma/schema.prisma` và `frontend/src/lib/api.ts`.                                                                                                                                                                                                                        |

Sitemap ghi `/opportunities` và `/opportunities/:id` là route công khai cho Guest và Student. Router frontend hiện chưa mount hai route nghiệp vụ; API client `apiRequest` đã có nhưng chưa có endpoint cơ hội.

## 2. Đối chiếu nghiệp vụ

| Yêu cầu                                | Nguồn                                                                                                    | Quy tắc/đề xuất trong hợp đồng                                                                                                                                                                                                                                                                                    | Điểm chưa chốt                                                                                                                                                                                                                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ai xem danh sách và chi tiết           | Chương 3 FR-02.1, UC-01/02, BR-01.5, BR-02.4; Chương 4 sitemap §4.1.1                                    | **Đã có căn cứ:** Guest và Student cùng đọc công khai, không cần đăng nhập. Endpoint không xác thực; gửi kèm phiên Admin cũng không làm lộ thêm dữ liệu.                                                                                                                                                          | Không có quyền khác cho API đọc công khai trong phạm vi này.                                                                                                                                                                                                                            |
| Loại tin được đưa vào Hub              | Chương 3 UC-01, BR-01.2, BR-02.1; Chương 4 §4.3.2.3                                                      | **Đã có căn cứ:** chỉ `Thực tập`, `Việc làm`, `Học bổng`. `Bài viết định hướng` thuộc Lộ trình kỹ năng/định hướng, không thuộc Hub cơ hội.                                                                                                                                                                        | Không có.                                                                                                                                                                                                                                                                               |
| Trạng thái duyệt và quyền xem chi tiết | Chương 3 BR-01.1, UC-01; Chương 4 `opportunities.status`                                                 | **Đã có căn cứ:** chỉ `Approved` được công khai. `Pending`/`Rejected` không xuất hiện trong danh sách và không được đọc qua endpoint chi tiết. Chi tiết không tồn tại và chi tiết không công khai cùng trả 404 để tránh tiết lộ trạng thái duyệt.                                                                 | Không có.                                                                                                                                                                                                                                                                               |
| Ý nghĩa `is_verified`                  | Chương 3 FR-02.3, UC-01, BR-01.3; Chương 4 `opportunities.is_verified`                                   | **Đã có căn cứ:** duyệt và cấp nhãn Verified là hai lựa chọn khác nhau. `Approved` không đồng nghĩa `is_verified=true`; trả boolean riêng, chỉ hiện huy hiệu khi true.                                                                                                                                            | Không có.                                                                                                                                                                                                                                                                               |
| Hết hạn, ngày không có giờ và NULL     | Chương 3 UC-01/BR-01.4; FR-03.2 mô tả riêng điều kiện gợi ý; nhóm đã chốt quy tắc date-only              | **Đã xác nhận:** date-only hết hạn tại 00:00 ngày sau theo `Asia/Ho_Chi_Minh` (UTC mốc `2026-11-05T17:00:00Z` cho ngày nguồn 05/11/2026), với `now >= cutoff`; UI vẫn hiện ngày nguồn 05/11/2026. Nguồn có giờ dùng instant chính xác, UTC; theo BR-01.4 hết hạn khi timestamp `< now`. NULL không hiện deadline. | Schema hiện chỉ lưu một `DATETIME(0)` và không ghi độ chính xác/date nguồn; cùng UTC instant có thể biểu diễn date-only cutoff hoặc timestamp nửa đêm. Nhóm chọn hướng metadata ở migration riêng sau này, nhưng chi tiết còn chờ review (xem §7). Không suy ra quy tắc recommendation. |
| Tìm kiếm và lọc                        | Chương 3 UC-02, BR-02.1–02.4; frame Figma 36:39                                                          | **Đã có căn cứ:** keyword khớp tiêu đề, đơn vị đăng hoặc kỹ năng yêu cầu; lọc chuyên ngành, loại cơ hội, hình thức làm việc; các tiêu chí kết hợp AND, các trường keyword kết hợp OR. Keyword không phân biệt hoa/thường.                                                                                         | Dự thảo quy định giới hạn độ dài, chuẩn hóa khoảng trắng và xử lý URL stale ở §4.                                                                                                                                                                                                       |
| Danh mục Active/Closed và liên kết cũ  | Chương 3 BR-02.3; Chương 4 `categories.status` và các bảng nối; người dùng đã xác nhận cách giữ liên kết | **Đã xác nhận:** lựa chọn bộ lọc chỉ cung cấp chuyên ngành `Active`; liên kết Major/Skill đã có với tin vẫn trả tên kể cả danh mục sau đó `Closed`. Keyword kỹ năng vẫn tìm theo tên của liên kết đã gắn, kể cả Skill Closed.                                                                                     | URL có `majorId` trỏ tới danh mục Closed được đề xuất trả 400; cần review riêng ở §4.                                                                                                                                                                                                   |
| Phạm vi bài viết định hướng            | Chương 3 BR-01.2; Chương 4 §4.3.2.3                                                                      | **Đã có căn cứ:** cùng lưu trong bảng `opportunities` nhưng không thuộc hai endpoint Hub này; không trả bài định hướng như cơ hội.                                                                                                                                                                                | Contract API `/roadmaps` thuộc phạm vi khác.                                                                                                                                                                                                                                            |
| Nguồn và thao tác mở `source_url`      | Chương 3 UC-01, BR-01.6; Chương 4 `source_url` nullable                                                  | **Đã có căn cứ:** trả URL khi có; UI chỉ hiện thao tác xem nguồn nếu có URL. Không dùng API làm redirect hoặc tự tải trang nguồn. `publisher` (đơn vị đăng) không đồng nghĩa với website nguồn.                                                                                                                   | Chương 4 cho phép `source_url` NULL; vì vậy Approved không đảm bảo mọi tin có liên kết nguồn. Chưa có tên nguồn riêng ngoài publisher/URL.                                                                                                                                              |
| Năm học liên quan                      | Chương 4 `opportunity_years`; nhóm đã xác nhận cách hiển thị khi không có liên kết                       | **Đã xác nhận:** API trả mảng năm học; nếu không có liên kết thì `[]` và UI ẩn mục. Không suy ra rằng tin áp dụng cho mọi năm, không áp dụng quy tắc năm học vào lọc Hub hoặc gợi ý.                                                                                                                              | Ý nghĩa của các năm đã gắn theo từng use case cần được giữ theo tài liệu nghiệp vụ tương ứng.                                                                                                                                                                                           |

## 3. Endpoint danh sách

### `GET /api/opportunities`

**Trạng thái:** đề xuất, chưa triển khai. **Truy cập:** công khai, không yêu cầu Google/JWT. Thành công trả HTTP 200 và `application/json` theo envelope `items`/`meta`.

Không truyền bộ lọc là hợp lệ cho UC-01 và trả feed mặc định. UC-02 yêu cầu có ít nhất một điều kiện khi người dùng bấm Tìm kiếm; nếu form rỗng, frontend hiển thị lời nhắc và không gửi request. Cùng một endpoint không thể phân biệt “mở feed” và “bấm tìm kiếm rỗng” chỉ từ GET.

| Query        | Kiểu/giới hạn đề xuất                                                        | Ý nghĩa                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`          | Chuỗi UTF-8, tối đa 100 code point; sau trim rỗng được xem như không truyền. | Tìm trong `title`, `publisher` và tên Skill thuộc `opportunity_skills`. Các trường này OR với nhau. Dùng collation đã chọn `utf8mb4_0900_as_ci`: không phân biệt hoa/thường, vẫn phân biệt dấu; chuẩn hóa Unicode NFC, trim hai đầu, không tự bỏ dấu hoặc đổi nội dung giữa các từ. Ký tự `%`, `_`, `\\` được tìm như ký tự thường, không thành wildcard SQL. |
| `majorId`    | Số nguyên dương trong miền `INT` có dấu.                                     | Chỉ khớp tin có liên kết tới đúng Major đang Active. Các Major trong một tin không nhân bản item.                                                                                                                                                                                                                                                             |
| `type`       | Một giá trị: `Thực tập`, `Việc làm`, `Học bổng`.                             | Lọc đúng loại. Không nhận `Bài viết định hướng` hoặc giá trị khác.                                                                                                                                                                                                                                                                                            |
| `workFormat` | Một giá trị: `Online`, `Offline`, `Hybrid`.                                  | Lọc đúng hình thức. NULL không khớp giá trị nào.                                                                                                                                                                                                                                                                                                              |
| `page`       | Số nguyên từ 1 đến 1,000,000; mặc định `1`.                                  | Trang theo offset. Trần trang là giới hạn kỹ thuật đề xuất, không phải yêu cầu nghiệp vụ.                                                                                                                                                                                                                                                                     |
| `pageSize`   | Số nguyên từ 1 đến 100; mặc định `20`.                                       | Số item/trang. Giá trị mặc định/tối đa đồng bộ đề xuất chung ở `api-conventions.md`.                                                                                                                                                                                                                                                                          |

Các bộ lọc `majorId`, `type`, `workFormat` kết hợp với nhau theo **AND**. Nhóm keyword là một điều kiện OR riêng, kết hợp với từng filter bằng **AND**. Không hỗ trợ nhiều giá trị lặp cho một tham số; không hỗ trợ `sort` query vì UC-01 đã định nghĩa thứ tự cố định. Tham số lặp hoặc query parameter không hỗ trợ trả 400/`INVALID_QUERY`.

**Chuẩn hóa và validation đề xuất:** phân tích số nghiêm ngặt, không chấp nhận số âm, số thập phân, chuỗi rỗng, giá trị thừa hay `NaN`; từ chối tham số lặp thay vì âm thầm lấy giá trị đầu/cuối. `pageSize` ngoài 1–100, `page` ngoài giới hạn, `type`/`workFormat` không hỗ trợ hoặc `q` quá dài trả 400/`INVALID_QUERY`. Một `majorId` không còn hợp lệ trả 400/`INVALID_FILTER`.

**Điều kiện dữ liệu:** mọi kết quả phải có `status = Approved` và thuộc ba loại cơ hội công khai. Không điều kiện nào từ query có thể nới tập trạng thái/loại này. Keyword kỹ năng tra qua liên kết Skill đã gắn, bao gồm liên kết tới category Closed theo quyết định nhóm. Filter chuyên ngành chỉ nhận Major Active.

**Sắp xếp:** theo UC-01, deadline còn hạn có giá trị xếp tăng dần; deadline NULL xếp sau nhóm còn hạn; deadline đã hết hạn xếp cuối. Với deadline date-only, `instant` là mốc loại trừ kế tiếp và hết hạn khi `evaluatedAt >= instant`; với nguồn có giờ, `instant` là timestamp chính xác và theo BR-01.4 hết hạn khi `instant < evaluatedAt`. Đề xuất thứ tự ổn định: deadline còn hạn ASC, NULL, deadline hết hạn ASC, sau đó `item_id ASC` làm khóa phụ. Thứ tự phụ trong nhóm hết hạn và khóa phụ là lựa chọn kỹ thuật chờ review. Một thời điểm UTC `evaluatedAt` được chụp cho cả sắp xếp và trạng thái hết hạn của một response.

**Phân trang và total:** offset-based, `total` là số cơ hội phân biệt sau mọi điều kiện; `totalPages = ceil(total / pageSize)`, bằng `0` khi `total = 0`. Nếu `page > totalPages`, đề xuất trả 200, `items: []`, giữ page đã yêu cầu trong meta và trả total thực tế; không trả 404. Concurrent insert/delete có thể làm item đổi trang giữa các request; đây là giới hạn của offset pagination. Dùng cùng predicate cho count và select.

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

`deadline` là `null` khi DB không có hạn nộp. Response mục tiêu dùng `precision: "date" | "datetime" | "unknown"`, `date` là ngày hiển thị theo `Asia/Ho_Chi_Minh` hoặc `null` nếu chưa xác minh, `instant` là UTC, `sourceTimeZone` giữ timezone nguồn cho datetime, và `state` do backend tính tại `meta.evaluatedAt`. Nếu nguồn chỉ ghi ngày `2026-11-05`, `instant` là cutoff loại trừ 00:00 ngày 06/11 giờ Việt Nam (`2026-11-05T17:00:00Z`); hết hạn khi `evaluatedAt >= instant`, còn UI hiển thị ngày nguồn `2026-11-05`. Nếu nguồn có giờ cụ thể, `instant` giữ đúng instant sau khi chuyển UTC, `sourceTimeZone` giữ zone/offset gốc, và UI hiển thị theo `Asia/Ho_Chi_Minh`; theo BR-01.4 hết hạn khi `instant < evaluatedAt` (tại đúng bằng nhau chưa nhỏ hơn). UI dùng `state` từ backend thay vì đồng hồ client. Quy tắc NULL trong recommendation nằm ngoài hợp đồng này.

**Giới hạn biểu diễn hiện tại:** `opportunities.deadline` là một `DATETIME(0)` UTC duy nhất, không có timezone, ngày nguồn riêng hoặc dấu hiệu cho biết nguồn chỉ ghi ngày hay có giờ cụ thể. Date-only 05/11 có cutoff `2026-11-05T17:00:00Z`. Timestamp chính xác 06/11 00:00 `Asia/Ho_Chi_Minh` cũng đổi thành đúng `2026-11-05T17:00:00Z`, nhưng hai bản ghi phải trả ngày UI khác nhau (05/11 và 06/11) và dùng comparator khác nhau. Không thể khôi phục khác biệt đó từ timestamp một cách an toàn. Nhóm đã chọn hướng metadata bằng migration riêng trong tương lai, chưa thay đổi schema hiện có. Đề xuất tối thiểu để review là `deadline_source_date DATE NULL` để lưu ngày gốc và đánh dấu date-only, cùng `deadline_source_timezone VARCHAR(64) NULL` để lưu zone/offset nguồn của datetime. Date-only lưu cutoff UTC trong `deadline`; datetime lưu instant chính xác trong `deadline`. Cách này cũng để phân biệt dữ liệu cũ chưa rõ độ chính xác khi cả metadata đều NULL. Tên/kiểu/constraint và migration cần được review; chưa thể tạo đầy đủ response mục tiêu từ schema hiện tại.

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

| HTTP | `error.code`          | Khi dùng                                                                                |
| ---- | --------------------- | --------------------------------------------------------------------------------------- |
| 400  | `INVALID_QUERY`       | Query sai kiểu/giới hạn, lặp, hoặc không hỗ trợ.                                        |
| 400  | `INVALID_FILTER`      | `majorId` không phải Major Active. Hành vi URL trỏ Closed là đề xuất riêng, cần review. |
| 503  | `SERVICE_UNAVAILABLE` | Backend nhận diện database không sẵn sàng; thông báo chung, không lộ MySQL/Prisma.      |
| 500  | `INTERNAL_ERROR`      | Lỗi bất ngờ; envelope hiện có, không lộ stack/SQL/configuration.                        |

Mọi lỗi giữ envelope `error.code`/`error.message` của `api-conventions.md`; chưa đề xuất `fieldErrors`.

### Phụ thuộc danh mục bộ lọc — TV3 sở hữu hợp đồng chung

BR-02.3 yêu cầu bộ chọn chuyên ngành chỉ gồm Major Active. Cần một API đọc danh mục dùng chung, không tạo API thứ hai trong module opportunities. Đề xuất gửi TV3 review hợp đồng chuẩn `GET /api/categories?type=Major&status=Active`, công khai, response tối thiểu `{ "items": [{ "id": 12, "name": "Kỹ thuật phần mềm" }] }`; trả danh sách tên ổn định theo `name`, chỉ gồm Major Active. **Đường dẫn, quyền đọc và format cuối cùng thuộc contract categories của TV3**; endpoint cơ hội chỉ tiêu thụ contract đó. Không dùng endpoint danh mục cho `type`/`workFormat` vì miền giá trị của chúng cố định trong Chương 4.

### URL có `majorId` đã đóng — cần review riêng

Nhóm đã chốt không đưa Closed vào danh sách filter nhưng chưa chọn phản hồi khi URL được lưu/bookmark trước lúc category đóng. **Đề xuất:** trả 400/`INVALID_FILTER` với thông báo trung tính “Bộ lọc chuyên ngành không còn hợp lệ.”; frontend báo và cho xóa filter, không âm thầm bỏ filter để tránh mở rộng kết quả. Phương án khác là trả 200 với danh sách rỗng hoặc đưa filter cũ vào trạng thái cần xóa ở UI. Chọn một phương án trước khi triển khai.

## 4. Endpoint chi tiết

### `GET /api/opportunities/:id`

**Trạng thái:** đề xuất, chưa triển khai. Công khai, không yêu cầu xác thực. `id` phải là số nguyên thập phân dương trong miền MySQL `INT` có dấu. ID sai cấu trúc/ngoài miền trả 400/`INVALID_ID`; ID hợp lệ không tồn tại, Pending, Rejected, bài định hướng hoặc không thuộc tập công khai trả cùng HTTP 404/`NOT_FOUND`.

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

| Trường API                                              | Kiểu/nullability                            | Nguồn/diễn giải                                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                    | integer                                     | `opportunities.item_id`.                                                                                                                                                                                                                                                   |
| `type`, `title`                                         | string                                      | `opportunity_type`, `title`; type giới hạn ba loại công khai.                                                                                                                                                                                                              |
| `publisher`                                             | string theo dữ liệu hợp lệ; schema nullable | `publisher`; ba loại công khai không NULL theo CHECK, nhưng UI cần phòng dữ liệu rỗng/sai.                                                                                                                                                                                 |
| `descriptionText`, `requirementsText`                   | string \| null                              | `description`, `requirements`; text thuần, nullable, không trả markup HTML.                                                                                                                                                                                                |
| `workFormat`                                            | `Online` \| `Offline` \| `Hybrid` \| null   | `work_format`; giá trị lấy từ CHECK hiện tại.                                                                                                                                                                                                                              |
| `location`                                              | string \| null                              | `location`; trả `null`/ẩn với Online theo BR-01.7.                                                                                                                                                                                                                         |
| `deadline`                                              | object \| null                              | `deadline`; object API mục tiêu gồm precision, ngày hiển thị, timezone nguồn, instant UTC và state tại `evaluatedAt`. Schema hiện chưa lưu precision/ngày nguồn/timezone; cần metadata ở migration riêng. Bản ghi cũ chưa xác minh trả unknown; không deadline trả `null`. |
| `isVerified`                                            | boolean                                     | `is_verified`; độc lập với trạng thái duyệt.                                                                                                                                                                                                                               |
| `sourceUrl`                                             | string URL \| null                          | `source_url`; chỉ mở trực tiếp khi hợp lệ, không tự lấy URL từ publisher.                                                                                                                                                                                                  |
| `majors`                                                | `{id, name}[]`                              | `opportunity_majors` nối `categories` type Major. Closed vẫn có thể xuất hiện nếu đã liên kết.                                                                                                                                                                             |
| `skills`                                                | `{id, name}[]`                              | `opportunity_skills` nối `categories` type Skill. Closed vẫn có thể xuất hiện/tìm kiếm nếu đã liên kết.                                                                                                                                                                    |
| `eligibleAcademicYears`                                 | `(1\|2\|3\|4)[]`                            | `opportunity_years.academic_year`; không có link trả `[]`.                                                                                                                                                                                                                 |
| `status`, `reviewedBy`, `reviewedAt`                    | Không trả                                   | `opportunities.status`, `reviewed_by`, `reviewed_at` là dữ liệu quy trình nội bộ; public query chỉ xác nhận eligibility, không cần lộ.                                                                                                                                     |
| Email/role/tài khoản Admin, lý do từ chối, activity log | Không trả                                   | Không thuộc UI công khai; không serialize quan hệ reviewer hoặc dữ liệu quản trị.                                                                                                                                                                                          |
| `created_at`                                            | Không trả                                   | Không có yêu cầu giao diện trong UC-01/02.                                                                                                                                                                                                                                 |

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
| Trang vượt phạm vi                  | Nếu API trả `items: []` nhưng `total > 0` và page > totalPages, frontend thay URL về trang cuối hợp lệ và tải lại; không hiện empty state như thể không có kết quả. Khi total=0, dùng empty state theo query.                                       |
| Lỗi danh sách                       | Hiển thị lỗi tải và nút thử lại; tách lỗi mạng/5xx khỏi empty. Query invalid hiển thị lỗi filter cụ thể, không báo “không có cơ hội”.                                                                                                               |
| Chi tiết loading/success/not found  | Loading; khi có `item`, render chi tiết; 404 hiển thị trạng thái không tìm thấy/không công khai, không hỏi đăng nhập.                                                                                                                               |
| Đầu vào thiết kế chi tiết công khai | Frame `171:2628` trong handoff là chi tiết ở khu vực kiểm duyệt Admin; hiện chưa xác nhận frame chi tiết cơ hội công khai. Bổ sung/định danh frame public trước khi dựng frontend chi tiết; không lấy frame Admin làm thiết kế thay thế.            |
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
| Major/Skill liên kết nhiều-nhiều, category Closed         | Mỗi cơ hội chỉ một lần và count chính xác; Closed liên kết vẫn trả/tìm kiếm; danh sách option chỉ Major Active. URL `majorId` Closed kiểm theo phương án được nhóm review. |
| Type/workFormat, tham số lặp/sai/không hỗ trợ             | Giá trị hợp lệ lọc chính xác; query sai trả 400; `Bài viết định hướng` không được dùng làm type Hub.                                                                       |
| Deadline date-only 05/11/2026                             | Cutoff exclusive là 06/11 00:00 `Asia/Ho_Chi_Minh` = `2026-11-05T17:00:00Z`; tại `now < cutoff` còn hạn, tại `now >= cutoff` hết hạn; UI giữ ngày nguồn 05/11/2026.        |
| Deadline có giờ cụ thể                                    | Giữ đúng instant nguồn sau đổi UTC và source timezone; theo BR-01.4 hết hạn khi `deadline < now`, bằng nhau chưa nhỏ hơn. UI hiển thị theo `Asia/Ho_Chi_Minh`.             |
| NULL deadline                                             | API trả `null`, UI không hiện hạn; không tự suy ra quy tắc recommendation.                                                                                                 |
| Bản ghi cũ không có metadata                              | Không suy đoán precision/date/timezone từ timestamp; metadata để NULL, API trả `precision/state: unknown`; UI không hiện ngày nguồn hay nhãn hết hạn tới khi xác minh.     |
| Date-only cutoff trùng datetime midnight                  | Trước metadata, hai giá trị có cùng UTC timestamp nhưng khác ngày hiển thị/comparator; metadata phải giữ đúng cả hai trường hợp.                                           |
| Deadline trùng nhau và phân trang                         | Tie-break `id ASC` ổn định; không trùng item/thiếu total do N-N; `page > totalPages` xử lý như contract được duyệt.                                                        |
| Năm học liên quan                                         | Trả đầy đủ các năm liên kết 1–4; không link trả `[]`; UI ẩn mục, không tự coi là mọi năm hoặc dùng cho gợi ý.                                                              |
| ID/query sai hoặc ID không tồn tại                        | ID hỏng 400; hợp lệ nhưng không có/không công khai cùng 404; tham số query xấu 400, không lộ SQL.                                                                          |
| `sourceUrl` NULL/hợp lệ/URL không hợp lệ                  | NULL không render link; link hợp lệ mở đúng nguồn; không tạo redirect/fetch từ server, không cho scheme nguy hiểm.                                                         |
| Database/backend lỗi                                      | 503/500 theo contract, message chung; UI hiện error/retry, không nhầm với empty và không lộ config/stack.                                                                  |
| Không lộ trường nội bộ                                    | Response không có reviewer, trạng thái nội bộ, email/role, log, lý do từ chối hoặc dữ liệu tài khoản.                                                                      |
| Tìm kiếm liên tục và Back                                 | Request cũ bị hủy/bỏ; Back khôi phục URL/list filter; direct detail có fallback an toàn.                                                                                   |

## 7. Metadata deadline — hướng đã chọn, schema tương lai cần review

Nhóm đã chọn **bổ sung metadata trong migration riêng sau này**. Mục tiêu là phân biệt nguồn chỉ ghi ngày với nguồn có giờ, giữ ngày nguồn và giữ múi giờ nguồn khi có giờ. Hợp đồng hết hạn đã xác nhận:

- Date-only `2026-11-05`: cutoff loại trừ là 00:00 ngày 06/11 theo `Asia/Ho_Chi_Minh`, tức `2026-11-05T17:00:00Z`; hết hạn khi `now >= cutoff`; UI hiển thị ngày nguồn 05/11/2026.
- Có giờ cụ thể: giữ exact instant UTC cùng timezone/offset nguồn; theo BR-01.4 hết hạn khi `instant < now`; tại đúng bằng nhau chưa nhỏ hơn.
- `deadline` NULL vẫn không có deadline. Không suy luận quy tắc recommendation từ contract này.

### Trường tối thiểu đề xuất

| Trường                                   | Trạng thái/kiểu đề xuất                         | Ý nghĩa                                                                                                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opportunities.deadline`                 | Đã có: MySQL `DATETIME(0)`; quy ước giá trị UTC | Date-only lưu cutoff UTC ngày kế tiếp; datetime lưu instant nguồn đã đổi UTC. DATETIME không tự lưu timezone.                                                                                                                 |
| `opportunities.deadline_source_date`     | **Đề xuất thêm:** `DATE NULL`                   | Ngày gốc chỉ được điền khi nguồn date-only; đây cũng là marker `precision=date`. NULL với datetime/legacy.                                                                                                                    |
| `opportunities.deadline_source_timezone` | **Đề xuất thêm:** `VARCHAR(64) NULL`            | Timezone nguồn cho datetime cụ thể, lưu tên IANA hoặc offset tường minh; bắt buộc với bản ghi datetime mới. NULL với date-only vì cutoff date-only dùng chính sách `Asia/Ho_Chi_Minh`, không phải timezone do nguồn cung cấp. |

Không đề xuất thêm cột `precision` riêng: `deadline_source_date` đánh dấu nguồn date-only; timezone nguồn đánh dấu datetime mới; deadline có giá trị nhưng cả hai metadata NULL là legacy chưa rõ precision. Quy ước này cần được Chương 4 review trước khi chốt constraint.

Quy ước nhất quán đề xuất: `deadline IS NULL` thì cả hai metadata đều NULL; date-only có `deadline_source_date` và NULL `deadline_source_timezone`; datetime mới có NULL `deadline_source_date` và timezone nguồn đúng như nguồn cung cấp; deadline có giá trị nhưng hai metadata đều NULL là bản ghi cũ **unknown**, không suy đoán từ giờ trong timestamp. Nếu nguồn chỉ ghi giờ nhưng thiếu timezone, phải xác minh trước khi ghi mới. Tên/độ dài/constraint chính thức cần review cùng Chương 4 và migration kế tiếp.

| Nguồn                               | Giá trị `deadline` UTC     | `deadline_source_date` | `deadline_source_timezone` | Ý nghĩa/API mục tiêu                                                                                                |
| ----------------------------------- | -------------------------- | ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Chỉ ghi ngày 05/11/2026             | `2026-11-05 17:00:00`      | `2026-11-05`           | `NULL`                     | `precision=date`; cutoff `2026-11-05T17:00:00Z`; UI hiện `05/11/2026`; hết hạn khi `now >= cutoff`.                 |
| 06/11/2026 00:00 `Asia/Ho_Chi_Minh` | `2026-11-05 17:00:00`      | `NULL`                 | `Asia/Ho_Chi_Minh`         | `precision=datetime`; cùng UTC instant với date-only 05/11 nhưng UI hiện `06/11/2026`; hết hạn khi `instant < now`. |
| Bản ghi cũ chỉ có `deadline`        | Giữ nguyên giá trị đang có | `NULL`                 | `NULL`                     | `precision=unknown`; không bịa ngày nguồn/timezone hoặc nhãn hết hạn.                                               |

Response API mục tiêu do đó có `deadline: null` hoặc `{ precision, date, sourceTimeZone, instant, state }`. `date` lấy từ `deadline_source_date` với date-only; với datetime là ngày hiển thị theo Asia/Ho_Chi_Minh. Date-only có `sourceTimeZone: null` vì timezone là chính sách cutoff; datetime trả nguyên timezone/offset nguồn đã lưu. Legacy có `precision: "unknown"`, `date: null`, `sourceTimeZone: null`, giữ `instant` UTC đang có và `state: "unknown"`. UI không thể hiển thị ngày nguồn hay nhãn hết hạn đúng cho legacy unknown; đề xuất tạm ẩn nhãn deadline đến khi xác minh lại nguồn. Hành vi fallback này cần review.

### Tác động tài liệu/mô hình

| Thành phần    | Cập nhật cần review                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chương 4      | §4.3.2.3 cần bổ sung ý nghĩa `deadline` là cutoff date-only hoặc instant datetime, ngày nguồn, timezone nguồn; đặc tả hai metadata mới và quy tắc NULL. Đây là đề xuất thay đổi Chương 4, chưa sửa PDF. |
| Prisma schema | Sau khi Chương 4 được duyệt, đề xuất thêm `deadline_source_date DateTime? @db.Date` và `deadline_source_timezone String? @db.VarChar(64)` vào `Opportunity`. Chưa sửa `schema.prisma`.                  |
| Migration     | Chỉ thêm migration mới được review sau này; không sửa initial migration đã áp dụng. Nhiệm vụ hiện tại không tạo/chạy migration.                                                                         |
| API           | Response deadline cần `precision`, `date`, `sourceTimeZone`, `instant`, `state`; comparator theo precision như trên. Chưa triển khai API.                                                               |

### Bản ghi cũ

Migration tương lai để metadata NULL cho bản ghi cũ; không backfill precision/date/timezone từ giờ timestamp, kể cả 00:00 hoặc 23:59:59. Chỉ điền metadata sau khi đối chiếu được nguồn thật; phần nào không xác minh được giữ unknown. Trước khi triển khai public API, nhóm cần duyệt fallback cho `precision/state=unknown` (đề xuất không hiển thị ngày gốc/nhãn hết hạn) để không khẳng định sai. Đây không phải yêu cầu sửa hoặc chạy initial migration.

## 8. Quyết định/đầu vào còn chờ review

1. Tên/kiểu/constraint của hai metadata deadline; Chương 4 cần duyệt trước khi tạo migration mới. Định dạng cho `deadline_source_timezone` phải tránh abbreviation mơ hồ; có thể chấp nhận IANA hoặc offset tường minh.
2. Figma public detail: handoff chỉ xác nhận frame `171:2628` là chi tiết khu vực Admin, không phải nguồn thiết kế public. Bổ sung/định danh frame chi tiết cơ hội công khai và states trước khi dựng frontend chi tiết.
3. Categories: TV3 chốt endpoint/shape và quyền đọc công khai cho Major Active; TV1 tiêu thụ contract chung, không tạo route filter trùng trong opportunities.
4. URL `majorId` Closed: review đề xuất 400/`INVALID_FILTER` và yêu cầu xóa filter; không âm thầm bỏ điều kiện.
5. Phân trang: review default/max `pageSize`, trần `page`, 400 cho query sai/lặp, và quy tắc page vượt total. Đề xuất hiện tại: page 1, pageSize 20, max 100, page tối đa 1,000,000; page vượt phạm vi trả 200 rỗng kèm total thực.
6. Thứ tự phụ: review deadline ASC trong các nhóm, thứ tự phần tử trong nhóm hết hạn và tie-break `item_id ASC`.
7. Fallback hiển thị cho bản ghi deadline legacy unknown; đề xuất ẩn nhãn deadline đến khi source được xác minh. Với nguồn giờ không có timezone, xác minh trước khi đổi UTC. Giữ đúng `source_url` và deadline nguồn; không đổi hạn tin thật để demo.
8. API công khai chỉ có dữ liệu Approved sau quy trình duyệt. **Chưa seed** trong nhiệm vụ này; không seed sẵn Approved để bỏ qua quy trình. Dữ liệu hư cấu chỉ dùng riêng cho test và phải ghi rõ.

## 9. Phụ thuộc triển khai

- Backend thuộc `backend/src/modules/opportunities`; frontend thuộc `frontend/src/features/opportunities`, cùng làm bởi TV1 theo [team-workflow](team-workflow.md).
- Danh sách chuyên ngành Active phụ thuộc contract categories do TV3 sở hữu. TV1 và TV3 thống nhất đường dẫn/shape trước khi tích hợp.
- Schema hiện tại đã có 15 trường opportunities và các bảng nối; contract không sửa schema/migration. Luồng date-only và datetime đầy đủ phụ thuộc metadata ở migration riêng trong tương lai. Xem [schema Prisma và migration](database-schema.md).
- Trước khi làm luồng mẫu, contract này phải được review; từng thành viên cần MySQL phát triển đã áp dụng initial migration. Runtime chỉ backend kết nối MySQL. Không dùng tài khoản DB của nhóm để chuẩn bị tài liệu.

### Ranh giới database và backend

| Database đã bảo đảm                                                                                                                                                                                                     | Backend vẫn phải bảo đảm                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PK/FK, NOT NULL/kiểu/độ dài, khóa ghép chống link trùng; CHECK status thuộc Pending/Approved/Rejected, work_format thuộc Online/Offline/Hybrid khi có giá trị, publisher không NULL với loại không phải bài định hướng. | Chỉ lọc Approved và ba loại công khai; xác thực đúng Major/Skill type qua FK categories; chỉ đưa Major Active vào filter; giữ Closed link; kiểm tra URL nguồn trước duyệt; xác thực miền `opportunity_type`, điều kiện `location` theo `workFormat`; tìm/filter/sort, phân trang không trùng item, chuẩn hóa deadline và loại dữ liệu quản trị khỏi response. |

CHECK/FK không quyết định quyền xem công khai, không xác thực category type/status, không bảo đảm URL an toàn hoặc quy tắc hiển thị. Xem [đối chiếu database/backend](database-schema.md#6-ranh-giới-database-và-backend).
