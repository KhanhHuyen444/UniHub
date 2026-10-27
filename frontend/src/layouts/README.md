# Layout dùng chung

Layout reusable cho một ứng dụng React:

- `PublicLayout`: header Guest mặc định cao 72 px, vùng nội dung tối đa 1200 px và footer Public. Route Hub cơ hội dùng variant riêng theo frame `36:39`: header 81 px và content wrapper 1280 px với padding ngang 32 px (inner 1216 px ở frame 1280).
- `StudentLayout`: header Student cao 64 px, vùng nội dung tối đa 1280 px và footer Student.
- `AdminLayout`: sidebar cố định 260 px, vùng nội dung co giãn và footer Admin cao 52 px.

Các layout nhận `children`, `activeKey` và `previewNavigation`. Feature route tương lai dùng navigation path thực của mình. Trong `/_dev/ui`, `previewNavigation` đổi link thành route preview/query để các mục chỉ đổi active state; không đi tới feature route chưa được triển khai. Preview Student/Admin là minh họa, không xác thực quyền.

Token CSS ở `frontend/src/styles/tokens.css`; Tailwind map các màu/font/size/surface trong `tailwind.config.js`. Inter variable được tự lưu tại `frontend/src/assets/fonts/InterVariable.woff2`, hỗ trợ weight trục 100–900 (ứng dụng dùng 400/500/600/700) và nạp với `font-display: swap`. File license SIL OFL 1.1 đi kèm trong cùng thư mục. Số đo frame 1280 là nguồn trực tiếp; cách căn giữa container ở 1920 px, scale spacing và chiều rộng footer logo là lựa chọn triển khai được ghi trong [implementation notes](../../../docs/shared-ui-design/implementation.md).

Footer giữ cột **Hỗ trợ** với “Điều khoản sử dụng” (`/terms`) và “Chính sách bảo mật” (`/privacy`) theo quyết định của nhóm. Hai trang dự kiến là nội dung tĩnh, không cần database/API riêng. Preview vẫn hiển thị chữ tĩnh đến khi có nội dung; chưa tạo trang rỗng hoặc tự viết điều khoản/chính sách. Dòng copyright là copy từ hình tham chiếu, chưa được xác nhận là nội dung pháp lý chính thức.

CSS hiện đặt logo footer 128 × 128 px, hai cột điều hướng 280 px ở màn hình rộng và 220 px khi viewport không quá 1400 px; footer có chiều cao tối thiểu 301.25 px. Đây là kích thước hiện triển khai, không phải số đo trực tiếp của asset/frame.

Frame nguồn: Public `24:1632`, Student `301:382`, Admin `166:940`. README gốc bàn giao, screenshot và JSON bằng chứng nằm tại `docs/shared-ui-design/`; chỉ asset dùng trong shell được import từ `frontend/src/assets/`.
