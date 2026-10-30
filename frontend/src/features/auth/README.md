# Xác thực frontend dùng chung

Frontend auth đang được triển khai trên nhánh `feat/auth-frontend`; backend cung cấp `POST /api/auth/google`, `POST /api/auth/refresh`, `GET /api/auth/me` và `POST /api/auth/logout` trên `main`. Hợp đồng: [auth-api-contract.md](../../../../docs/auth-api-contract.md).

`AuthProvider` khôi phục phiên khi khởi động. Access JWT chỉ ở bộ nhớ trang; refresh secret chỉ nằm trong cookie HttpOnly do backend quản lý. Không dùng localStorage/sessionStorage, không tin role từ GIS và không tạo cơ chế auth thứ hai. `protectedApiRequest` tự gửi Bearer token, dùng chung một lần refresh cho request song song và chỉ retry request bị 401 một lần. Dùng `RequireRole role="Admin"` bọc route Admin; backend vẫn phải kiểm tra quyền.

```tsx
<Route
  path="/admin/module"
  element={
    <RequireRole role="Admin">
      <AdminModulePage />
    </RequireRole>
  }
/>
```

Trong module được bảo vệ, gọi `protectedApiRequest` cho API nghiệp vụ cần xác thực. Không gửi role do giao diện tự chọn; guard chỉ dùng role từ `/api/auth/me` và server vẫn kiểm tra mọi route.

`LoginPage` dùng nút Google Identity Services chính thức, gửi ID token nguyên trạng tới backend rồi đọc hồ sơ qua `/api/auth/me`. Đăng xuất xóa state cục bộ ngay và gọi backend để thu hồi đúng session; nếu máy chủ không xác nhận, LoginPage hiển thị cảnh báo sau điều hướng.

## Chạy local trên Windows

1. Tạo OAuth Web client trong Google Cloud theo cấu hình nhóm; thêm origin `http://127.0.0.1:5173` vào client và backend `AUTH_ALLOWED_ORIGINS`. Dùng cùng client ID ở frontend `VITE_GOOGLE_CLIENT_ID` và backend `GOOGLE_CLIENT_ID`. Client ID là public; không đặt client secret hoặc khóa backend vào frontend.
2. Tại gốc repository, sao chép `frontend/.env.example` thành `frontend/.env` nếu tệp chưa có, rồi thay placeholder `VITE_GOOGLE_CLIENT_ID` bằng client ID đã cấp. Không commit `.env`.
3. Chạy backend/frontend theo README. Mở `http://127.0.0.1:5173/login`; Google sẽ chuyển ID token qua frontend tới backend same-origin `/api`.

Kiểm thử trong nhánh dùng API fetch double và trình duyệt với API/GIS mock để kiểm tra luồng giao diện. Chưa xác minh thông tin OAuth thật hoặc đăng nhập Google production. Admin shell trong `/_dev/ui?area=admin` tiếp tục là preview tĩnh, không giả lập người đăng nhập; khi module sản phẩm dùng `AdminLayout`, tên/email và đăng xuất lấy từ auth context thật.

## Session bridge cho module nhận props

Dùng trực tiếp `useAuth()` trong component cha dưới `AuthProvider` hiện có:

```tsx
const { accessToken, role, user, status } = useAuth();
```

Token, role và user được phát cùng một snapshot: login/restore/refresh cập nhật
consumer, kể cả khi chỉ token thay đổi. Logout và bắt đầu đăng nhập tài khoản khác
xóa ngay cả ba giá trị; status khi đăng nhập/khôi phục là `restoring`. Kết quả
login/refresh thuộc revision cũ không được khôi phục identity trước đó.
Không lưu hoặc ghi log snapshot vì nó chứa access token trong memory.
Cầu nối này không tự thêm refresh vào API consumer nhận props.

## Protected API opt-in

`protectedApiRequest(path, options)` là điểm opt-in, dùng lại `apiRequest` và
refresh single-flight hiện có. Không có interceptor tự gắn vào client chung.
Public APIs tiếp tục dùng `apiRequest`. Các endpoint `/api/auth/*`, bao gồm `/me`,
chỉ đi qua luồng Auth hiện có; protected helper từ chối các path đó trước khi fetch.

- Chỉ response HTTP 401 mới cho phép replay request gốc tối đa một lần. Nếu token
  đã được request đồng thời thay mới thì dùng token mới, không refresh lần nữa.
  Nếu phải refresh trước request vì thiếu token, 401 kế tiếp kết thúc luôn.
- 403, 409 (kể cả PROFILE_INCOMPLETE), 503, lỗi mạng và dữ liệu response lỗi không
  kích hoạt refresh/replay. POST/PATCH/DELETE chỉ replay sau 401 rõ ràng từ lớp
  Auth server; lỗi mạng hoặc kết quả ghi chưa rõ phải kiểm tra lại dữ liệu trước
  khi người dùng gửi lại, không tự retry.
- Signal được giữ nguyên cho request gốc/retry. Caller bị abort ngừng chờ ngay;
  không hủy refresh cookie dùng chung hoặc làm hỏng caller khác đang chờ.
- Kết quả thành công/lỗi của request cũ bị từ chối bằng
  `AuthOperationInvalidatedError` sau logout/login khác hoặc đổi owner. Consumer
  vẫn cần hủy/bỏ qua request khi unmount và xóa dữ liệu hiển thị khi session đổi.

Recommendations, Admin Categories và Skill Options chưa chuyển sang helper này.
Cần phối hợp Quyên thay lệnh gọi `apiRequest` trong API consumer được bảo vệ bằng
`protectedApiRequest`, giữ parser/validation/signal và xử lý session đổi ở parent.
Không cần tự thêm refresh hoặc lưu token trong module. Việc đổi token qua props
có thể hủy/remount workspace hiện tại; cần kiểm thử phối hợp để tránh replay mutation
sau abort hoặc lặp reload không cần thiết. Đây chưa phải tích hợp hoàn chỉnh.

Unit test transport: `npm.cmd run test --workspace @unihub/frontend -- test/auth-protected-request.test.mjs`.

## Route integration

`SessionRoutes.tsx` nối `useAuth()` vào hai page TV3; router khai báo:

- `/recommendations`: RequireRole Student + StudentLayout.
- `/admin/categories`: RequireRole Admin + AdminLayout, activeKey categories.

Chỉ có một AuthProvider. Guard chờ restore, Guest tới login với returnTo nội bộ,
sai role tới /403; lỗi dịch vụ có retry. Adapter chỉ remount page khi user ID đổi
để bỏ state cũ và kích hoạt cleanup AbortSignal của page. Admin Opportunities
list/detail và các route cũ giữ nguyên. AppRoutes được tách khỏi BrowserRouter
để kiểm thử cùng khai báo route thật trong MemoryRouter.

Recommendations nhận callback đăng nhập lại: xóa/revoke phiên hiện tại qua logout
chung để guard đưa tới login với return path, tránh LoginPage tự đưa phiên hết hạn
quay lại trang. Không có route /profile: không truyền onCompleteProfile, giữ
hướng dẫn PROFILE_INCOMPLETE trong page. Task 2 cần cung cấp route/UI Profile
trước khi nối callback. Không tạo trang hoặc dữ liệu thay thế.

Đây chỉ là tích hợp session/route. API consumer TV3 vẫn dùng apiRequest, nên 401
của Recommendations/Admin Categories không tự kích hoạt protectedApiRequest.
Cần phối hợp Quyên đổi consumer và kiểm thử token rotation/remount/abort trước
khi tuyên bố hoàn tất refresh consumer. Token mới tiếp tục được truyền qua props.
AdminCategoriesPage tự key workspace bằng accessToken nên vẫn reset form khi rotate;
giữ form qua refresh cần Quyên sửa bên trong module. Không giữ token cũ để né reset.

Test render dùng router/page thật nhưng không chạy effects hoặc navigation của
trình duyệt. Test `auth-routes-browser.test.mjs` dùng Auth/API fixture và báo SKIP
nếu môi trường thiếu Playwright; không chứng minh Google OAuth/MySQL thật.

StudentLayout dùng Button icon chung và icon logout hiện có, không đổi nav/href hoặc
cấu trúc breakpoint. Nút bị disable khi preview/restoring/Guest. Click gọi logout
chung (xóa memory ngay, single-flight chống gửi trùng) và chuyển tới /login bằng
replace; nếu revoke thất bại, LoginPage/PublicLayout hiển thị lỗi từ Auth state.
Không khôi phục user/token cũ khi lỗi; chưa xác minh bố cục trình duyệt ở 1280–1920.

## Cookie mutation coordination

Login, refresh và logout dùng chung một FIFO trong Auth. Restore đi qua refresh
single-flight. Login/logout đổi revision và xóa identity cũ ngay khi được gọi;
login đã bị thao tác mới thay thế trong hàng đợi không gửi request. Logout luôn
hoàn thành trước login được xếp sau nó; refresh không chạy trong lúc login/logout
đang chờ. Hàng đợi chờ cả response và xác minh /me, không dựa vào abort hoặc
revision để ngăn Set-Cookie cũ. Response lỗi không làm kẹt các thao tác tiếp theo.

Test cookie jar giả lập áp dụng cookie ở lúc nhận headers, trước kiểm tra revision,
và kiểm tra cả owner trong cookie/state. Logout thành công xóa cả hai; lỗi mạng
logout chỉ xóa memory và giữ cảnh báo chưa xác nhận revoke (không thể tự xóa cookie
HttpOnly bằng JavaScript). Lỗi đọc body sau headers vẫn phải kết thúc trước khi
request thay cookie kế tiếp được gửi.

Bảo đảm FIFO chỉ trong một JavaScript context đang sống. Chưa đồng bộ nhiều tab,
chưa bảo đảm khi đóng/reload trang giữa request hoặc các client khác dùng cùng
cookie. Không tuyên bố bảo đảm cookie toàn cục: cần phối hợp nhóm về giao thức
đa tab và kiểm tra session/generation phía backend nếu yêu cầu bao phủ các tình
huống này; không sửa backend/contract trong bước này. Request Auth treo sẽ giữ
hàng đợi chờ để tránh cho request thay cookie mới vượt qua nó. Chưa kiểm chứng
Set-Cookie trên trình duyệt thật hoặc Google OAuth thật.
