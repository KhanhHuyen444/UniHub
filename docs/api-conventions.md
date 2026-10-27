# Quy ước API UniHub

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

Phản hồi JSON được trả nguyên dạng cho caller. HTTP lỗi đọc `error.code`/`error.message` theo envelope hiện tại; body lỗi không phải JSON chỉ trả thông báo HTTP tổng quát, không đưa HTML hoặc nội dung upstream ra UI. Lỗi mạng được chuẩn hóa thành `ApiError`; lỗi hủy `AbortError` được giữ nguyên để caller xử lý riêng. Phản hồi thành công rỗng (204 hoặc body rỗng) trả `undefined`; phản hồi thành công có body không phải JSON tạo `INVALID_RESPONSE`. Client không kiểm tra schema nghiệp vụ: caller vẫn cần xác thực shape dữ liệu khi sử dụng.

## Hợp đồng theo chức năng

- [Hub cơ hội → Chi tiết cơ hội](opportunities-api-contract.md) đã thống nhất; `GET /api/opportunities` và `GET /api/opportunities/:id` cùng frontend list/detail đã có trên `main` sau PR #12. Consumer Major của Hub cũng có trên `main`; API cơ hội vẫn tự kiểm tra Major Active trong database.
- [API đọc danh mục dùng chung](categories-api-contract.md): contract và `GET /api/categories?type=Major` đã có trên `main` sau PR #13. Endpoint chỉ trả Major Active với shape `{items:[{id,name,type}]}`. Luồng Major consumer/API cùng Public Hub đã được kiểm thử tích hợp; xem [báo cáo](opportunities-integration-test.md). Skill và hồ sơ Closed vẫn ngoài phạm vi/chờ TV2/TV3.
- [Hợp đồng xác thực và phân quyền](auth-api-contract.md) là **dự thảo để review**, chưa có endpoint auth hoặc middleware được triển khai. Hợp đồng giữ Google ID token → backend verification → JWT UniHub và nêu các phụ thuộc schema/session.
- `page=1`, `pageSize=20`, tối đa 100 là baseline kỹ thuật đang đề xuất chung; endpoint phải ghi giới hạn thực tế và khóa sort ổn định. Contract cơ hội đã duyệt các giá trị này cùng trần page 1,000,000; quyết định đó không mặc nhiên áp dụng cho API khác.
- Thời gian lưu/trao đổi đã thống nhất UTC; giao diện dùng `Asia/Ho_Chi_Minh`. Chính sách date-only theo từng nghiệp vụ và biểu diễn trong `DATETIME(0)` được ghi ở hợp đồng tương ứng.

## Dự thảo cho API nghiệp vụ — cần nhóm thống nhất

Các quy ước dưới đây **chưa phải endpoint hoặc hợp đồng nghiệp vụ đã được triển khai**. Mỗi PR chức năng cần ghi contract cụ thể trước khi code.

| Chủ đề       | Đề xuất để review                                                                                                                                                                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đường dẫn    | Tiền tố `/api`, tên tài nguyên rõ ràng ở dạng số nhiều; thống nhất cách đặt path trước khi tạo endpoint                                                                                                                                                                                             |
| JSON         | Request có `Content-Type: application/json`; response JSON với kiểu dữ liệu rõ, không đổi null thành chuỗi rỗng tùy ý                                                                                                                                                                               |
| Payload      | Chọn tên field và quy tắc chuyển đổi nhất quán; không tự coi tên cột SQL là API contract hoặc tự đổi tên cột database                                                                                                                                                                               |
| HTTP status  | 200 đọc/cập nhật, 201 tạo, 204 xóa thành công không body; 400 dữ liệu sai, 401 chưa có phiên hợp lệ, 403 thiếu quyền, 404 không tìm thấy, 409 xung đột, 500 lỗi nội bộ. Client hỗ trợ 204 và body thành công rỗng; contract từng endpoint phải nêu status thực tế                                   |
| Phân trang   | Đề xuất page bắt đầu từ 1, pageSize mặc định 20 và tối đa 100; response có items và meta gồm page/pageSize/total/totalPages. Cần chốt thứ tự sắp xếp ổn định trước khi triển khai                                                                                                                   |
| Tìm kiếm/lọc | Nêu rõ tham số hỗ trợ, khoảng giá trị, chuẩn hóa chuỗi và hành vi tham số không hợp lệ; không nhận tùy tiện tên cột/SQL từ client                                                                                                                                                                   |
| Ngày giờ     | JSON API dùng ISO 8601 có `Z` cho instant; DB và session MySQL theo UTC; giao diện hiển thị `Asia/Ho_Chi_Minh`. MySQL `DATETIME` không tự lưu timezone. Schema/migration cơ hội có metadata ngày nguồn/timezone; dữ liệu cũ thiếu metadata trả unknown, không suy đoán. API lịch cần contract riêng |
| Lỗi          | Giữ cấu trúc error.code/error.message; nếu cần lỗi từng field, thống nhất fieldErrors trước. Không trả stack, SQL, mật khẩu hoặc token                                                                                                                                                              |

401/403 ở bảng trên là dự thảo HTTP API. Các trang 403/404 của UI và mô tả quyền trong Chương 3–4 cần đối chiếu khi viết contract, không lấy bảng này để tự ghi đè nghiệp vụ.

## Ranh giới bảo mật đã chốt và phần còn mở

Frontend nhận Google ID token từ Google Identity Services, backend xác minh rồi phát JWT riêng UniHub. Guest là trạng thái chưa đăng nhập, không lưu trong users.role. Server kiểm tra quyền và ownership; guard frontend chỉ giúp điều hướng. Chỉ backend được kết nối MySQL.

Chương 3 NFR-02.4 quy định access tối đa 15 phút, refresh tối đa 7 ngày trong cookie `HttpOnly`, `Secure`, `SameSite=Strict`, và đọc lại role khi refresh. Theo BR-14.5, role được ký vào JWT tại lần cấp token; middleware dùng role đã ký và chỉ lần cấp token kế tiếp mới nhận role mới. Đề xuất `google_sub`, session/refresh, CSRF và Origin được ghi tại [auth-api-contract.md](auth-api-contract.md). Schema chưa có identity/session cần thiết; chưa có endpoint login/refresh/logout hoặc middleware xác thực trong scaffold. Chương 3 không yêu cầu khóa tài khoản.
