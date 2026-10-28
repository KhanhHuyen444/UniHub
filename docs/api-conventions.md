# Quy ước API UniHub

Mục lục và endpoint × role matrix nằm trong [api-contracts.md](api-contracts.md). Tài liệu này ghi hành vi HTTP đang có trên `main` và quy ước chung; module-specific proposals chưa được coi là approved hoặc implemented.

## Các endpoint đã triển khai

### `GET /api/health` — liveness

Chỉ xác nhận tiến trình HTTP còn phản hồi; không gọi database hoặc đăng nhập. Phản hồi HTTP 200, `Content-Type: application/json`, `Cache-Control: no-store`:

```json
{ "status": "ok", "service": "unihub-api" }
```

Đây là kiểm tra HTTP server, không phải trạng thái MySQL/Google/JWT. Express cũng có phản hồi HEAD theo cơ chế mặc định của GET, không phải endpoint nghiệp vụ riêng.

### `GET /api/ready` — readiness

Chạy truy vấn chỉ đọc `SELECT 1` qua Prisma Client dùng chung. Phản hồi thành công HTTP 200:

```json
{ "status": "ready", "service": "unihub-api", "database": "available" }
```

Nếu `DATABASE_URL` chưa có, URL không hợp lệ hoặc database không truy vấn được, trả HTTP 503 với một trong các mã `DATABASE_NOT_CONFIGURED`, `DATABASE_CONFIGURATION_INVALID` hoặc `DATABASE_UNAVAILABLE`. Phản hồi không chứa URL, username, password, SQL hoặc stack trace. Lỗi kết nối chỉ ghi log thông báo chung, không serialize lỗi driver. Cả endpoint đều không xác thực chức năng nghiệp vụ hoặc trạng thái Google/JWT.

Route không tồn tại trả HTTP 404:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Không tìm thấy tài nguyên."
  }
}
```

### API đọc cơ hội

`GET /api/opportunities` trả danh sách public đã duyệt theo query, filter, page và thứ tự cố định trong [hợp đồng cơ hội](opportunities-api-contract.md). `GET /api/opportunities/:id` trả detail public; ID hợp lệ nhưng không tồn tại hoặc không công khai cùng trả 404. Hai route không cần xác thực. Lỗi database trả 503/`SERVICE_UNAVAILABLE`, khác với kết quả rỗng HTTP 200.

Middleware JSON giới hạn 100 KB. JSON sai trả 400/`INVALID_JSON`, vượt giới hạn trả 413/`PAYLOAD_TOO_LARGE`, encoding/charset không hỗ trợ trả 415/`UNSUPPORTED_ENCODING`; lỗi bất ngờ trả 500/`INTERNAL_ERROR`. Phản hồi không đưa stack trace, thông tin cấu hình hoặc request body ra client. Kiểm tra body có thể chạy trước xử lý route; một request tới route không tồn tại với JSON lỗi có thể nhận 400 thay vì 404.

Frontend gọi `/api/health` qua `frontend/src/lib/api.ts`, kiểm tra HTTP status và shape JSON; timeout 5 giây, hủy/bỏ qua request đã hết hiệu lực. Trong phát triển, Vite chuyển tiếp `/api` tới `API_PROXY_TARGET`. Không hardcode địa chỉ backend vào từng component, không thêm CORS chỉ để né cấu hình proxy. Cấu hình production chưa được triển khai.

### API client dùng chung ở frontend

Đã triển khai `apiRequest` trong `frontend/src/lib/api.ts`. Client nhận path cùng tiền tố `/api`, hỗ trợ `GET`, `POST`, `PATCH`, `DELETE`, query qua `URLSearchParams`, JSON body, `AbortSignal` và các tùy chọn `fetch` cần thiết. Client không tự chuyển tên field, gắn JWT, lưu token, ghi log hoặc tạo thông báo UI; từng feature phải dùng đúng contract đã review. Không truyền URL tuyệt đối để tránh bỏ qua Vite proxy và gọi nhầm origin.

Phản hồi JSON được trả nguyên dạng cho caller. HTTP lỗi hiện đọc `error.code`/`error.message` theo envelope hiện tại; body lỗi không phải JSON chỉ trả thông báo HTTP tổng quát, không đưa HTML hoặc nội dung upstream ra UI. Lỗi mạng được chuẩn hóa thành `ApiError`; lỗi hủy `AbortError` được giữ nguyên để caller xử lý riêng. Phản hồi thành công rỗng (204 hoặc body rỗng) trả `undefined`; phản hồi thành công có body không phải JSON tạo `INVALID_RESPONSE`. Client không kiểm tra schema nghiệp vụ: caller vẫn cần xác thực shape dữ liệu khi sử dụng. Contract `fieldErrors` đã được duyệt nhưng chưa triển khai; API client hiện chưa giữ trường này. Parser/client và error middleware/server sẽ được mở rộng trong PR code riêng, không đổi `code`, `kind`, `status` hoặc cách xử lý lỗi tổng quát hiện tại.

## Hợp đồng theo chức năng

- [Hub cơ hội → Chi tiết cơ hội](opportunities-api-contract.md) đã thống nhất; `GET /api/opportunities` và `GET /api/opportunities/:id` cùng frontend list/detail đã có trên `main` sau PR #12. Consumer Major của Hub cũng có trên `main`; API cơ hội vẫn tự kiểm tra Major Active trong database.
- [API đọc danh mục dùng chung](categories-api-contract.md): TV1 triển khai và merge contract/`GET /api/categories?type=Major` qua PR #13; TV3 tiếp quản provider dùng chung. Endpoint chỉ trả Major Active, ví dụ `{"items":[{"id":12,"name":"Kỹ thuật phần mềm","type":"Major"}]}`. Luồng Major consumer/API cùng Public Hub đã được kiểm thử tích hợp; xem [báo cáo](opportunities-integration-test.md). Skill và hồ sơ Closed vẫn là draft chờ leader review.
- `page=1`, `pageSize=20`, tối đa 100 là baseline kỹ thuật đang đề xuất chung; endpoint phải ghi giới hạn thực tế và khóa sort ổn định. Contract cơ hội đã duyệt các giá trị này cùng trần page 1,000,000; quyết định đó không mặc nhiên áp dụng cho API khác.
- Thời gian lưu/trao đổi đã thống nhất UTC; giao diện dùng `Asia/Ho_Chi_Minh`. Chính sách date-only theo từng nghiệp vụ và biểu diễn trong `DATETIME(0)` được ghi ở hợp đồng tương ứng.

### Endpoint × role hiện có và trạng thái hợp đồng

| Endpoint                                               |            Guest |            Student |                  Admin | Trạng thái trên `main`                                                 |
| ------------------------------------------------------ | ---------------: | -----------------: | ---------------------: | ---------------------------------------------------------------------- |
| `GET /api/health`, `GET /api/ready`                    |               Có |                 Có |                     Có | Đã triển khai; readiness truy vấn DB nhưng không xác thực user.        |
| `GET /api/opportunities`, `GET /api/opportunities/:id` |               Có |                 Có |    Cùng dữ liệu public | Đã triển khai và kiểm thử tích hợp.                                    |
| `GET /api/categories?type=Major`                       |               Có |                 Có |  Cùng danh sách Active | Đã triển khai; Major Active only.                                      |
| Auth login/refresh/me/logout                           |                — |                  — |                      — | Chưa triển khai; contract đề xuất tại `auth-api-contract.md`.          |
| Profile, admin users/roles, Skill/Admin categories     |                — |                  — |                      — | Chưa triển khai; contract proposals.                                   |
| Guidance, recommendations                              | Public / Student |            Student |                      — | Chưa triển khai; guidance public, recommendation Student-only dự thảo. |
| Admin opportunities/moderation/categories/dashboard    |                — |                  — |                  Admin | Chưa triển khai; endpoint roles đề xuất ở module docs.                 |
| Events/notifications                                   |                — |            Student |                      — | Chưa triển khai; Student-only proposal.                                |
| Forum reads/posts/comments                             |       Guest read | Student read/write | Guest-like read per UC | Chưa triển khai; proposal.                                             |

Guest indicates no UniHub access token; it is not stored in `users.role`. All protected endpoint permission rows above are contract intent, not implemented middleware. Do not infer that an Admin may use Student-only endpoints.

## Quy ước đề xuất cho API chưa triển khai

Các quy ước dưới đây là baseline kỹ thuật; contract theo module ở [api-contracts.md](api-contracts.md) mới quyết định field, role, status, pagination và thứ tự cụ thể. Draft/proposal chưa được tự nâng thành quyết định nhóm. Endpoint/API đã triển khai và contract approved được ghi riêng ở trên.

| Chủ đề       | Đề xuất để review                                                                                                                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đường dẫn    | Tiền tố `/api`, tên tài nguyên rõ ràng ở dạng số nhiều; thống nhất cách đặt path trước khi tạo endpoint                                                                                                                                                                                             |
| JSON         | Request có `Content-Type: application/json`; response JSON với kiểu dữ liệu rõ, không đổi null thành chuỗi rỗng tùy ý                                                                                                                                                                               |
| Payload      | Chọn tên field và quy tắc chuyển đổi nhất quán; không tự coi tên cột SQL là API contract hoặc tự đổi tên cột database                                                                                                                                                                               |
| HTTP status  | 200 đọc/cập nhật, 201 tạo, 204 xóa thành công không body; 400 dữ liệu sai, 401 chưa có phiên hợp lệ, 403 thiếu quyền, 404 không tìm thấy, 409 xung đột, 500 lỗi nội bộ. Client hỗ trợ 204 và body thành công rỗng; contract từng endpoint phải nêu status thực tế                                   |
| Phân trang   | Đề xuất page bắt đầu từ 1, pageSize mặc định 20 và tối đa 100; response có items và meta gồm page/pageSize/total/totalPages. Cần chốt thứ tự sắp xếp ổn định trước khi triển khai                                                                                                                   |
| Tìm kiếm/lọc | Nêu rõ tham số hỗ trợ, khoảng giá trị, chuẩn hóa chuỗi và hành vi tham số không hợp lệ; không nhận tùy tiện tên cột/SQL từ client                                                                                                                                                                   |
| Ngày giờ     | JSON API dùng ISO 8601 có `Z` cho instant; DB và session MySQL theo UTC; giao diện hiển thị `Asia/Ho_Chi_Minh`. MySQL `DATETIME` không tự lưu timezone. Schema/migration cơ hội có metadata ngày nguồn/timezone; dữ liệu cũ thiếu metadata trả unknown, không suy đoán. API lịch cần contract riêng |
| Lỗi          | Giữ `error.code`/`error.message`; contract đã duyệt cho phép `error.fieldErrors` tùy chọn với `source`, `field`, `code`, `message` ổn định như ví dụ dưới. Không trả stack, SQL, mật khẩu hoặc token. `message` chỉ để hiển thị; client không phân tích nội dung tiếng Việt.                        |

### Lỗi validation theo field — contract đã duyệt, triển khai ở PR code riêng

Giữ HTTP status, `error.code` và `error.message` hiện có. Với validation trả `400` và `error.code: "VALIDATION_ERROR"`, server có thể trả thêm mảng tùy chọn:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu gửi lên chưa hợp lệ.",
    "fieldErrors": [
      {
        "source": "body",
        "field": "title",
        "code": "REQUIRED",
        "message": "Vui lòng nhập tiêu đề."
      }
    ]
  }
}
```

`source` thuộc `body`, `query` hoặc `path`; `field` là tên field API/path ổn định, không phải tên cột SQL; `code` là mã máy ổn định do endpoint quy định. Có thể có nhiều lỗi cho cùng field. Frontend ánh xạ bằng cặp `source` + `field` và quyết định UI bằng `code`; chỉ hiển thị `message`, không suy luận lỗi bằng cách phân tích message tiếng Việt. Không hợp thức hóa bằng cách nhét field name vào message.

Đây là phần mở rộng cộng thêm, không bỏ/đổi field cũ. Consumer hiện tại tiếp tục nhận `ApiError.code`, `kind`, `status` và message như trước nhưng chưa thể hiển thị lỗi cạnh field. PR code riêng sẽ bổ sung `fieldErrors` tùy chọn vào backend `ApiError`/error middleware và frontend `ApiError`/parser. Parser phải xác thực shape; thiếu hoặc sai shape thì bỏ qua phần field details nhưng vẫn xử lý lỗi tổng quát cũ.

**Ma trận kiểm thử:** lỗi cũ chỉ có `code/message` vẫn parse như trước; `fieldErrors` hợp lệ được giữ nguyên theo từng `source/field/code`; field có nhiều lỗi ánh xạ đúng; message tiếng Việt không bị dùng để phân nhánh; `fieldErrors` thiếu, sai kiểu hoặc sai shape không làm hỏng `ApiError` tổng quát; HTTP status và `code/kind` cũ không đổi.

401/403 là quy ước HTTP cho API, nhưng quyền và mã lỗi từng route phải theo contract module. Không dùng bảng baseline để tự ghi đè nghiệp vụ Chương 3–4.

## Ranh giới bảo mật và hợp đồng auth

Frontend nhận Google ID token; backend xác minh token trước khi cấp JWT UniHub. Guest không phải role trong `users`. Backend kiểm tra token, role và ownership; frontend route guard chỉ giúp điều hướng. Chỉ backend kết nối MySQL. BR-14.5 quy định role mới có hiệu lực tại lần cấp token tiếp theo: middleware dùng role snapshot đã ký, không đọc `users.role` cho mỗi request.

Thời hạn Access 15 phút/Refresh 7 ngày, Google `sub`, `auth_sessions`, refresh rotation/revoke và session-bound access token đã được ghi trong [auth-api-contract.md](auth-api-contract.md), nhưng toàn bộ auth contract vẫn chờ leader duyệt và chưa triển khai. Chương 4 mới có `google_sub`/`auth_sessions`, còn schema/migration trên `origin/main` chưa có. Đây không chặn hoàn thiện/duyệt contract; chặn chạy auth trên database thật tới khi migration được review, merge, áp dụng và GRANT được xác nhận. Xem [bảng tổng hợp](api-contracts.md).
