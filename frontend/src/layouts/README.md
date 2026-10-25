# Layout dùng chung

Public, Student và Admin là các khu vực trong một ứng dụng React. Chưa tạo layout, navbar, footer, sidebar hay component menu: Figma không truy cập được do proxy trả 403, và không suy diễn hình ảnh từ sitemap. Màn hình kỹ thuật hiện có ở `app/App.tsx`; route được khai báo tập trung tại `app/router.tsx`.

Trước khi dựng layout, cần nhóm cung cấp frame hoặc ảnh đầy đủ của: (1) trang Public có navbar/footer; (2) shell Student, tối thiểu profile, recommendations, calendar và forum; (3) shell Admin trên dashboard và moderation có cả tab duyệt cơ hội/kiểm duyệt forum. Ảnh cần ghi kích thước viewport 1280 px và 1920 px, trạng thái menu đang mở/đóng và phần đầu/cuối trang.

Cần thông số token gồm font và trọng lượng, cấp cỡ chữ, màu brand/semantic, lưới và chiều rộng nội dung, spacing, chiều cao navbar/footer/sidebar, nhãn và đích liên kết, kích thước/radius/viền/đổ bóng, cùng trạng thái focus/disabled/loading/error của nút, input, badge. Chỉ tạo component/layout sau khi đối chiếu các nguồn này; component riêng của nghiệp vụ nằm trong feature tương ứng.
