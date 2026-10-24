# Quy ước API UniHub

## Phần đã triển khai trong scaffold

Chỉ **`GET /api/health`** là endpoint ứng dụng đã triển khai. Không yêu cầu database hoặc đăng nhập. Phản hồi HTTP 200, `Content-Type: application/json`, `Cache-Control: no-store`:

```json
{ "status": "ok", "service": "unihub-api" }
```

Đây là kiểm tra HTTP server, không phải trạng thái MySQL/Google/JWT. Express cũng có phản hồi HEAD theo cơ chế mặc định của GET, không phải endpoint nghiệp vụ riêng.

Route không tồn tại trả HTTP 404:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Không tìm thấy tài nguyên."
  }
}
```

Middleware JSON giới hạn 100 KB. JSON sai trả 400/`INVALID_JSON`, vượt giới hạn trả 413/`PAYLOAD_TOO_LARGE`, encoding/charset không hỗ trợ trả 415/`UNSUPPORTED_ENCODING`; lỗi bất ngờ trả 500/`INTERNAL_ERROR`. Phản hồi không đưa stack trace, thông tin cấu hình hoặc request body ra client. Kiểm tra body có thể chạy trước xử lý route; một request tới route không tồn tại với JSON lỗi có thể nhận 400 thay vì 404.

Frontend gọi `/api/health` bằng fetch, kiểm tra HTTP status và shape JSON; timeout 5 giây, hủy/bỏ qua request đã hết hiệu lực. Trong phát triển, Vite chuyển tiếp `/api` tới `API_PROXY_TARGET`. Không hardcode địa chỉ backend vào từng component, không thêm CORS chỉ để né cấu hình proxy. Cấu hình production chưa được triển khai.

## Dự thảo cho API nghiệp vụ — cần nhóm thống nhất

Các quy ước dưới đây **chưa phải endpoint hoặc hợp đồng nghiệp vụ đã được triển khai**. Mỗi PR chức năng cần ghi contract cụ thể trước khi code.

| Chủ đề       | Đề xuất để review                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Đường dẫn    | Tiền tố `/api`, tên tài nguyên rõ ràng ở dạng số nhiều; thống nhất cách đặt path trước khi tạo endpoint                                                                                                                             |
| JSON         | Request có `Content-Type: application/json`; response JSON với kiểu dữ liệu rõ, không đổi null thành chuỗi rỗng tùy ý                                                                                                               |
| Payload      | Chọn tên field và quy tắc chuyển đổi nhất quán; không tự coi tên cột SQL là API contract hoặc tự đổi tên cột database                                                                                                               |
| HTTP status  | 200 đọc/cập nhật, 201 tạo, 204 xóa thành công không body; 400 dữ liệu sai, 401 chưa có phiên hợp lệ, 403 thiếu quyền, 404 không tìm thấy, 409 xung đột, 500 lỗi nội bộ                                                              |
| Phân trang   | Đề xuất page bắt đầu từ 1, pageSize mặc định 20 và tối đa 100; response có items và meta gồm page/pageSize/total/totalPages. Cần chốt thứ tự sắp xếp ổn định trước khi triển khai                                                   |
| Tìm kiếm/lọc | Nêu rõ tham số hỗ trợ, khoảng giá trị, chuẩn hóa chuỗi và hành vi tham số không hợp lệ; không nhận tùy tiện tên cột/SQL từ client                                                                                                   |
| Ngày giờ     | Đề xuất ISO 8601 có timezone trên API, chuẩn hóa UTC để lưu/xử lý; giao diện hiển thị theo múi giờ được nhóm thống nhất. MySQL DATETIME không tự lưu timezone, nên cần quy ước chuyển đổi và test rõ trước migration/nghiệp vụ lịch |
| Lỗi          | Giữ cấu trúc error.code/error.message; nếu cần lỗi từng field, thống nhất fieldErrors trước. Không trả stack, SQL, mật khẩu hoặc token                                                                                              |

401/403 ở bảng trên là dự thảo HTTP API. Các trang 403/404 của UI và mô tả quyền trong Chương 3–4 cần đối chiếu khi viết contract, không lấy bảng này để tự ghi đè nghiệp vụ.

## Ranh giới bảo mật đã chốt và phần còn mở

Frontend nhận Google ID token từ Google Identity Services, backend xác minh rồi phát JWT riêng UniHub. Guest là trạng thái chưa đăng nhập, không lưu trong users.role. Server kiểm tra quyền và ownership; guard frontend chỉ giúp điều hướng. Chỉ backend được kết nối MySQL.

Thời hạn token/cookie đã ghi trong architecture và Chương 3 được giữ nguyên. Tài liệu này **không tự chốt thêm** lưu access token, refresh rotation/thu hồi, CSRF, CORS/origin hay liên kết Google sub; phải xử lý các điểm mở trước khi làm auth. Chưa có endpoint login/refresh/logout hoặc middleware xác thực trong scaffold.
