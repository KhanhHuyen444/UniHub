# Hướng dẫn Agent trong UniHub

- Đọc README.md, docs/technology-stack.md, docs/architecture.md và tài liệu workflow/API trước khi sửa. Kiểm tra nhánh, remote, working tree; bảo toàn thay đổi sẵn có.
- Giữ React/TypeScript/Vite/Tailwind 3.4, Node 24/Express/TypeScript ES modules, MySQL/Prisma, npm workspaces và một package-lock.json ở gốc. Không tự nâng major hoặc đổi stack.
- Kiểm tra trạng thái chức năng theo source và test hiện tại; ghi chú scaffold/PR lịch sử không phản ánh đầy đủ main. Chỉ sửa đúng phạm vi được giao, không tạo endpoint/dữ liệu mẫu để giữ chỗ hoặc suy diễn Figma chưa đọc được.
- Tổ chức theo feature/module. Admin chia theo chức năng năm thành viên trong docs/team-workflow.md; thay đổi phần chung phải nêu tác động và phối hợp review.
- Schema/migration chỉ ở backend/prisma/; không sửa lịch sử migration đã áp dụng. Cài đặt local theo docs/LOCAL-SETUP-UNIHUB-DEMO.md với unihub_demo; không thao tác unihub_dev trong quy trình bàn giao. Giữ mô hình 13 bảng (gồm `auth_sessions`), phân biệt DB constraint và backend rule; thay đổi dữ liệu/quyền quan trọng cần nhóm chốt. Không tự kết nối/ghi DB nếu nhiệm vụ không yêu cầu.
- Chỉ backend kết nối MySQL và giữ bí mật. Không đọc/in `.env` thật, token, mật khẩu hoặc đưa chúng vào Git/log. Biến VITE\_ là dữ liệu có thể công khai. Không commit node_modules, dist, coverage hoặc dữ liệu chạy cục bộ.
- Lệnh tại **gốc repository**: `npm ci`, `npm run typecheck`, `npm run build`, `npm test`, `npm run format:check`. Windows PowerShell dùng `npm.cmd`. Chạy kiểm tra phù hợp thay đổi; không tuyên bố test UI/DB/NFR nếu chưa thực hiện.
- Dùng script tương thích Windows, dependency khai báo trong workspace sử dụng. Không thêm công cụ trùng mục đích. Quyết định nhỏ và đảo ngược được thì tự xử lý, ghi lại; chỉ hỏi khi có mâu thuẫn quan trọng chưa giải quyết.
- Làm trên nhánh riêng; commit/push/PR theo phạm vi được người dùng cho phép. Không tự merge main, force-push, reset lịch sử, xóa nhánh, sửa quyền repository hoặc deploy hosting.
- Môi trường Codex đã tách biệt: dùng checkout hiện có, không tự tạo worktree. Công cụ sẵn trên Codex không chứng minh máy Windows đã cài; báo cáo rõ môi trường kiểm tra và giới hạn.
