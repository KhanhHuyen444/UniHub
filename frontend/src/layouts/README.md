# Layout dùng chung

Layout reusable cho một ứng dụng React:

- `PublicLayout`: header Guest cao 72 px, vùng nội dung tối đa 1200 px và footer Public.
- `StudentLayout`: header Student cao 64 px, vùng nội dung tối đa 1280 px và footer Student.
- `AdminLayout`: sidebar cố định 260 px, vùng nội dung co giãn và footer Admin cao 52 px.

Các layout nhận `children`, `activeKey` và `previewNavigation`. Feature route tương lai dùng navigation path thực của mình. Trong `/_dev/ui`, `previewNavigation` đổi link thành route preview/query để các mục chỉ đổi active state; không đi tới feature route chưa được triển khai. Preview Student/Admin là minh họa, không xác thực quyền.

Token CSS ở `frontend/src/styles/tokens.css`; Tailwind map các màu/font/size/surface trong `tailwind.config.js`. Số đo frame 1280 là nguồn trực tiếp; cách căn giữa container ở 1920 px, scale spacing và chiều rộng footer logo là lựa chọn triển khai được ghi trong [implementation notes](../../../docs/shared-ui-design/implementation.md). Inter được ưu tiên nhưng không bundle font: máy cần có Inter để khớp tuyệt đối, nếu không sẽ dùng system sans.

Footer giữ cột **Hỗ trợ** và hai label trong screenshot. Hiện chúng là text tĩnh vì repository chưa có quyết định/URL đã duyệt; không biến thành liên kết giả và không tự viết điều khoản/chính sách. Dòng copyright cũng là copy từ hình tham chiếu, chưa được xác nhận là nội dung pháp lý chính thức.

Frame nguồn: Public `24:1632`, Student `301:382`, Admin `166:940`. README gốc bàn giao, screenshot và JSON bằng chứng nằm tại `docs/shared-ui-design/`; chỉ asset dùng trong shell được import từ `frontend/src/assets/`.
