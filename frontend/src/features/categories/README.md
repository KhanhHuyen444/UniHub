# Danh sách kỹ năng cho Student — Bảo Quyên

GET /api/categories?type=Skill ở backend chỉ dành cho Student và trả về các Skill có trạng thái Active.
Profile dùng SkillOptionsField với selectedIds do thành phần cha kiểm soát. Bản sửa này không
cần thay đổi backend, Profile, Auth dùng chung, bộ định tuyến, lược đồ hay cơ sở dữ liệu.

## Auth dùng chung và vòng đời yêu cầu

- getSkillOptions(accessToken, signal?) giữ nguyên chữ ký hiện có cho Profile.
  Tham số token chỉ báo khả năng sẵn sàng; không bao giờ được gửi trong header.
  Bắt buộc phải có Student đã xác thực trong kho trạng thái Auth dùng chung. Guest/Admin
  bị từ chối ngay phía máy khách mà không gửi yêu cầu; Auth/RBAC ở backend vẫn quyết định quyền truy cập.
- protectedApiRequest cung cấp token Auth hiện tại. Sau 401, Auth dùng chung
  làm mới phiên, xác minh /me và thử lại một lần. Làm mới không hợp lệ hoặc
  lần thử lại cuối cùng trả 401 sẽ xóa trạng thái Auth; gián đoạn dịch vụ làm mới khiến Auth không khả dụng.
  Không bổ sung lưu trữ token, giải mã JWT, bộ quản lý làm mới hay cơ chế Auth nào khác.
- Chuỗi truy vấn giữ nguyên chính xác type=Skill, không có phần thân. AbortSignal được chuyển tiếp
  qua yêu cầu đầu tiên/lần thử lại; từ chối yêu cầu đã hủy trước đó và kết quả thành công đến sau khi hủy.
  Việc làm mới dùng chung thuộc Auth và có thể hoàn tất ngay cả khi bên sử dụng này hủy yêu cầu.
  Bên sử dụng đã hủy không bao giờ công bố kết quả đến muộn.
- useSkillOptions đăng ký theo dõi cùng kho trạng thái đáng tin cậy với AuthProvider. Phạm vi sở hữu
  yêu cầu dựa trên ID người dùng, vai trò và phiên bản phạm vi, thay vì nội dung token.
  Luân chuyển token của cùng người dùng giữ lại tác vụ đang chờ/kết quả mà không tải lại.
  Thao tác thử lại chủ động dùng token Auth hiện tại. Đăng xuất, đổi tài khoản/vai trò,
  khôi phục/không khả dụng và gỡ thành phần làm mất hiệu lực/hủy tác vụ trước đó. Đăng xuất/đăng nhập
  cùng người dùng trong một đợt cập nhật không thể khôi phục kết quả từ phạm vi trước.
- Guest được hiển thị thông báo đăng nhập, Admin bị từ chối truy cập, quá trình khôi phục hiển thị trạng thái tải,
  còn gián đoạn dịch vụ Auth hiển thị lỗi khác với phiên không hợp lệ. Bộ bảo vệ tuyến Profile thực tế
  phụ trách giao diện khôi phục phiên/đăng nhập. Không thay đổi hành vi Auth toàn cục.

## Lựa chọn do Profile kiểm soát và hợp đồng

Các thuộc tính hiện có của trường vẫn là accessToken, role, selectedIds, onChange và
disabled tùy chọn. Trạng thái tải, lỗi Auth và lỗi yêu cầu tạm thời không bao giờ gọi
onChange hay xóa selectedIds. Các lựa chọn Active vẫn giữ những ID hiện có ngoài danh sách;
Profile tiếp tục phụ trách nhãn/xóa liên kết Closed, đặt lại biểu mẫu theo tài khoản và
lưu dữ liệu. Không có bộ nhớ đệm danh sách lựa chọn dùng chéo giữa người dùng.

Bộ phân tích yêu cầu ID MySQL INT dương, duy nhất, tên không rỗng dài tối đa 100 điểm mã
và kiểu chính xác là Skill. Bộ phân tích giữ thứ tự từ backend và chỉ lấy id/name/type.
Các dòng có trường trạng thái là không hợp lệ; backend phụ trách lọc Active. Phản hồi thành công
rỗng được phân biệt với lỗi. Bản sửa này không thay đổi giao diện tìm kiếm/thẻ lựa chọn.

## Kiểm chứng

Chạy từ thư mục gốc kho mã với Node 24:

```powershell
node --import tsx --test frontend/test/skill-options-api.test.mjs frontend/test/auth.test.mjs
node --import tsx --test frontend/test/skill-options-field.test.mjs
node --import tsx --test frontend/test/skill-options-integration.test.mjs
npm.cmd run typecheck
npm.cmd run build
npm.cmd run format:check
```

Kiểm thử API dùng đối tượng thay thế fetch và các mô-đun Auth dùng chung thực tế. Phạm vi gồm
làm mới thành công, bị từ chối, gián đoạn dịch vụ, giới hạn số lần thử lại, hủy trong khi làm mới/thử lại,
luân chuyển token đồng thời, kiểm soát vai trò và kiểm tra phản hồi hiện có.
Kiểm thử trình duyệt gắn trường thực tế và kho trạng thái Auth dùng chung với HTTP được chặn:
số lần thử lại sau làm mới, trạng thái Auth kết thúc, các ID Active/Closed đã chọn qua
lỗi/thử lại, luân chuyển token cùng người dùng, đổi tài khoản, đăng xuất trong khi làm mới,
đăng xuất/đăng nhập cùng người dùng trong một đợt cập nhật, hủy/kết quả đến muộn và gỡ thành phần.
Playwright/Chromium do môi trường kiểm thử cung cấp; không thêm phụ thuộc cho ứng dụng.
Thiếu trình chạy kiểm thử trình duyệt sẽ báo SKIP.

Kiểm thử tích hợp tùy chọn yêu cầu TEST_SKILL_OPTIONS_DATABASE_URL trỏ đến cơ sở dữ liệu
unihub_skill_options_test\* tạm thời trên địa chỉ loopback, có các migration hiện hành và
users/categories rỗng. HTTP/Auth/MySQL của danh mục dùng dữ liệu kiểm thử thực trong giao dịch
chỉ hoàn tác; chỉ chặn phản hồi từ chối làm mới cho tình huống giao diện token không hợp lệ
vì bộ kiểm thử đó không có cookie đăng nhập. Không bao giờ dùng cơ sở dữ liệu của nhóm. Thiếu
cấu hình sẽ báo SKIP. Tác vụ này không cấp phát hay truy cập cơ sở dữ liệu.
Đăng nhập Google, cookie làm mới thực, toàn bộ định tuyến Profile, quyền/dữ liệu production,
hiệu năng và triển khai vẫn nằm ngoài phạm vi các kiểm thử mô phỏng/trình duyệt này.

## Kiểm chứng cục bộ trên bản gốc 49fc07a

Windows, Node 24.19.0 / npm 11.17.0: API Skill 13 PASS, trình duyệt 10 PASS,
Auth dùng chung 12 PASS, điều hướng Auth 9 PASS, đơn vị/API Profile 7 PASS,
luồng Profile trên trình duyệt 9 PASS, trang Profile trên trình duyệt 1 PASS và điều hướng Profile
3 PASS: 64 PASS / 0 FAIL. Kiểm thử MySQL tùy chọn là 1 SKIP; không truy cập cơ sở dữ liệu.
Kiểm tra kiểu, dựng ứng dụng và kiểm tra định dạng ở gốc đều PASS với quy trình sinh Prisma client thông thường.
Vite báo cảnh báo kích thước gói; bộ kiểm thử trình duyệt cảnh báo cấu hình content của Tailwind rỗng.
Cả hai cảnh báo đều không làm các kiểm tra này thất bại hay giải thích các lỗi URL cũ.

### So sánh điều kiện kiểm tra chuyển về trang chủ của Profile

Bản gốc sạch được trích từ git archive 49fc07a vào thư mục tạm,
không chứa mã nguồn cục bộ hay tệp môi trường. Bản gốc và nhánh này dùng cùng
Node/Chromium, các phụ thuộc đã cài, cờ kiểm thử và bộ mô phỏng HTTP. Không sửa
checkout/worktree nào khác. Cả ba kiểm thử ban đầu đều thất bại tại
page.waitForURL(base + '/\_dev/health') trên cả bản gốc và nhánh:

| Kiểm thử hiện có                                                                                                      | main ban đầu | Bản sửa Skill, điều kiện ban đầu | main, điều kiện đã sửa | Bản sửa Skill, điều kiện đã sửa |
| --------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------- | ---------------------- | ------------------------------- |
| Đăng nhập Google: Student chưa hoàn tất hồ sơ ghi đè returnTo; hoãn thiết lập về trang chủ, không PUT hay lặp Profile | FAIL         | FAIL                             | PASS                   | PASS                            |
| Đăng nhập Google: Student đã hoàn tất hồ sơ mặc định về trang chủ                                                     | FAIL         | FAIL                             | PASS                   | PASS                            |
| PUT Profile thành công về trang chủ và hiển thị xác nhận bất kể returnTo                                              | FAIL         | FAIL                             | PASS                   | PASS                            |

Cả ba đều là điều kiện kiểm tra đã lỗi thời từ trước, không phải lỗi hồi quy Skill hay
lỗi bộ kiểm thử riêng của máy. main gắn HomePage tại /; hoãn thiết lập Profile,
lưu thành công và đăng nhập mặc định của Student đã hoàn tất hồ sơ đều chuyển đến đó, phù hợp
với hành vi hiện tại trong README của Profile/UC-05. URL kiểm tra sức khỏe khi phát triển là tuyến riêng.

Chỉ ba điều kiện kiểm tra URL trong frontend/test/profile-flow.test.mjs đổi thành /.
Các kiểm thử vẫn yêu cầu điều hướng hồ sơ chưa hoàn tất, không PUT khi hoãn thiết lập, không lặp Profile
khi điều hướng công khai, mặc định về trang chủ, đúng một PUT thành công
và thông báo xác nhận đã lưu. Không thay đổi logic production của Profile/Auth/bộ định tuyến.
Người phụ trách Profile (Thái Bình) cần rà soát điều chỉnh chỉ gồm ba dòng kiểm thử này cùng
bản sửa Skill; tác vụ này chưa gửi yêu cầu rà soát bên ngoài hay PR.

Không khẳng định đã nghiệm thu đầu cuối với đăng nhập Google, cookie và MySQL thực.
