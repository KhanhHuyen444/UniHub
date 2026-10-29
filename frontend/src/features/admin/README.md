# Frontend Admin

Admin dùng `RequireRole` cùng auth dùng chung, `AdminLayout` (tên/email và logout thật), và API client tại `features/admin/opportunities/api.ts`. Hiện nhánh `feat/admin-opportunities-frontend` có hàng chờ Pending, chi tiết, approve/reject theo [hợp đồng](../../../../docs/admin-opportunities-api-contract.md). Không có dashboard, CRUD cơ hội, kiểm duyệt diễn đàn hoặc API Skill trong phạm vi này.

## Kiểm duyệt cơ hội

- Route: `/admin/opportunities` và `/admin/opportunities/:id`.
- Bốn request dùng `protectedApiRequest`: GET hàng chờ, GET chi tiết, POST approve, POST reject.
- `AdminLayout` mở mục Kiểm duyệt nội dung; người dùng chưa đăng nhập đi qua `/login?returnTo=...`, Student tới `/403`; kiểm tra quyền thực sự vẫn do backend.
- Reject yêu cầu lý do đã trim, 1–500 ký tự; approve xác nhận lựa chọn Verified. Mutation đang gửi sẽ khóa các nút để tránh gửi lặp.
- Queue/detail có trạng thái loading, empty, error/retry; 401/403/404/409/422/validation có thông báo riêng. 409 tải lại cả hàng chờ lẫn chi tiết.
- Ngày deadline lấy ngày nguồn từ API; unknown được ghi “Chưa xác định hạn”. Nội dung hiển thị dạng text, URL nguồn chỉ mở khi parser xác nhận HTTP(S).

## Căn cứ giao diện

Handoff chung xác nhận sidebar Admin rộng 260 px, vùng nội dung padding 32 px, màu, typography Inter và các icon shell từ frame `166:940` (Dashboard). Ảnh “Tin chờ thẩm định” do nhóm đính kèm là căn cứ bố cục trang duyệt. Tỷ lệ cột queue/detail, khoảng cách, padding card, kích thước nội dung và cách co giãn ở 1920 px được ước lượng từ ảnh; đây không phải số đo trực tiếp Figma. Email liên hệ nội bộ, dashboard, tab/route Giám sát cộng đồng không có trong API/phạm vi và không được dựng từ nội dung mẫu trong ảnh.

Backend API đã có trên `main` qua PR #24. Auth frontend được kế thừa từ `feat/auth-frontend` và vẫn cần merge trước khi luồng UI này có thể chạy trên `main`.

DTO giữ `publisher` nullable như backend. Khi thiếu, queue/detail hiển thị “Chưa có đơn vị đăng” để Admin vẫn xem và từ chối; điều kiện backend yêu cầu publisher khi duyệt không thay đổi.
