# UniHub Skill Roadmap Demo Seed

Bộ dữ liệu định hướng kỹ năng và nghề nghiệp (Skill Roadmap & Career Guidance) phục vụ môi trường demo UniHub (`unihub_demo`), tuân thủ chặt chẽ Chương 3 UC-03 / FR-03.1 / BR-03.1–03.3 và `docs/guidance-api-contract.md`.

> **Lưu ý nghiệp vụ:** Đây là dữ liệu **system-preloaded Guidance Articles** được nạp sẵn với `status = "Approved"` và `opportunity_type = "Bài viết định hướng"`, **KHÔNG** phải dữ liệu lộ trình cá nhân hóa lưu theo từng sinh viên.

---

## 1. Cấu trúc bộ dữ liệu (146 Guidance Articles)

Bộ dữ liệu bao phủ 100/117 chuyên ngành (85.5%) thuộc toàn bộ 10 nhóm ngành trong danh mục chuẩn `data/catalog/major-skill-mapping.json`, đồng thời giữ lại 17 chuyên ngành rỗng (14.5%) để kiểm thử hành vi Empty State theo UC-03.

### 1.1. Tầng A — 28 Core Majors (112 bài viết)

Gồm 28 chuyên ngành cốt lõi, mỗi chuyên ngành có trọn vẹn 4 giai đoạn từ Năm 1 đến Năm 4:

- **CNTT & Công nghệ số (8):** Công nghệ thông tin, Khoa học máy tính, Kỹ thuật phần mềm, Hệ thống thông tin, Khoa học dữ liệu, Trí tuệ nhân tạo, An toàn thông tin, Thương mại điện tử.
- **Kinh tế & Quản trị (8):** Quản trị kinh doanh, Marketing, Kế toán, Tài chính - Ngân hàng, Công nghệ tài chính, Kinh doanh quốc tế, Logistics và Quản lý chuỗi cung ứng, Luật kinh tế.
- **Ngôn ngữ, Xã hội & Nhân văn (4):** Ngôn ngữ Anh, Quan hệ quốc tế, Truyền thông đa phương tiện, Tâm lý học.
- **Kỹ thuật & Công nghiệp (4):** Kỹ thuật điện, Kỹ thuật điều khiển và tự động hóa, Kỹ thuật cơ điện tử, Kỹ thuật xây dựng.
- **Khoa học tự nhiên & Sự sống (3):** Toán ứng dụng, Công nghệ sinh học, Công nghệ thực phẩm.
- **Thiết kế & Nghệ thuật (1):** Thiết kế đồ họa.

### 1.2. Tầng B — 17 Cụm ngành mở rộng (34 bài viết)

Bao phủ 72 chuyên ngành liên quan qua 2 giai đoạn nền tảng (Năm 1 và Năm 2) chia sẻ chung năng lực chuyên môn:

1. `cluster-hardware-network` (4 majors): Mạng máy tính và truyền thông dữ liệu, Kỹ thuật máy tính, Công nghệ kỹ thuật máy tính, Kỹ thuật điện tử - viễn thông.
2. `cluster-finance-audit` (3 majors): Quản trị rủi ro, Kiểm toán, Tài chính.
3. `cluster-econ-analytics` (3 majors): Kinh tế, Kinh tế quốc tế, Kinh tế phát triển.
4. `cluster-digital-biz` (3 majors): Kinh doanh số và trí tuệ nhân tạo, Kinh doanh thương mại, Hệ thống thông tin quản lý.
5. `cluster-hr-office` (3 majors): Quản trị nhân lực, Quản trị văn phòng, Đảm bảo chất lượng.
6. `cluster-journalism-pr` (3 majors): Truyền thông, Báo chí, Quan hệ công chúng.
7. `cluster-law-governance` (1 major): Luật.
8. `cluster-mechanical-auto` (3 majors): Kỹ thuật cơ khí, Kỹ thuật ô tô, Kỹ thuật hàng không.
9. `cluster-chem-materials` (5 majors): Kỹ thuật hóa học, Kỹ thuật vật liệu, Kỹ thuật môi trường, Kỹ thuật hệ thống công nghiệp, Kỹ thuật y sinh.
10. `cluster-arch-design` (3 majors): Kiến trúc, Thiết kế công nghiệp, Kỹ thuật xây dựng công trình giao thông.
11. `cluster-pure-sciences` (7 majors): Toán học, Vật lý học, Hóa học, Sinh học, Khoa học môi trường, Khoa học vật liệu, Khoa học và công nghệ thực phẩm.
12. `cluster-languages` (4 majors): Ngôn ngữ Trung Quốc, Ngôn ngữ Nhật, Ngôn ngữ Hàn Quốc, Ngôn ngữ Pháp.
13. `cluster-social-sciences` (5 majors): Xã hội học, Công tác xã hội, Đông phương học, Việt Nam học, Nhân học.
14. `cluster-education-pedagogy` (8 majors): Giáo dục học, Quản lý giáo dục, Giáo dục Tiểu học, Giáo dục Mầm non, Sư phạm Toán học, Sư phạm Ngữ văn, Sư phạm Tiếng Anh, Sư phạm Tin học.
15. `cluster-agri-env` (7 majors): Nông học, Khoa học cây trồng, Bảo vệ thực vật, Chăn nuôi, Quản lý tài nguyên và môi trường, Quản lý đất đai, Kinh tế nông nghiệp.
16. `cluster-health-medicine` (7 majors): Y khoa, Dược học, Điều dưỡng, Y tế công cộng, Kỹ thuật xét nghiệm y học, Kỹ thuật hình ảnh y học, Dinh dưỡng.
17. `cluster-hospitality` (3 majors): Quản trị khách sạn, Quản trị dịch vụ du lịch và lữ hành, Quản trị nhà hàng và dịch vụ ăn uống.

### 1.3. 17 Chuyên ngành Empty State (0 bài viết)

Chủ động để trống lộ trình để kiểm chứng giao diện Empty State và API contract `stages: []`:

- Bất động sản, Địa chất học, Địa lý tự nhiên, Du lịch học, Hải dương học, Lịch sử, Nuôi trồng thủy sản, Quản lý công, Quản lý thông tin, Răng - Hàm - Mặt, Thiết kế nội thất, Thiết kế thời trang, Thông tin - Thư viện, Thú y, Triết học, Văn học, Y học cổ truyền.

---

## 2. Tiêu chuẩn nội dung & Kỹ thuật

- **Trường văn bản:** `description` và `requirements` được định dạng thuần văn bản (plain text với `whitespace-pre-wrap`), tuyệt đối không có thẻ HTML hoặc ký tự Markdown heading gây lỗi giao diện.
- **Kỹ năng liên kết:** 100% kỹ năng (154 kỹ năng duy nhất) đều thuộc danh mục Active trong bảng `categories` và đúng với mapping ngành học.
- **Metadata Synthetic:**
  - `opportunity_type`: `"Bài viết định hướng"`
  - `status`: `"Approved"`
  - `publisher`: `"UniHub Ban Cố vấn Học tập & Hướng nghiệp"`
  - `is_verified`: `false` (không giả mạo trạng thái xác minh của đối tác)
  - `reviewed_by`: `null` (không tạo tài khoản duyệt giả)
  - Các trường tuyển dụng (deadline, work_format, location, source_url): `null`

---

## 3. Hướng dẫn sử dụng & Kiểm thử

### Kiểm chứng Fixture:

```bash
node data/guidance/demo/generate-guidance-demo.mjs
```

### Dry-run (mặc định, không thay đổi DB):

```bash
node --env-file=backend/.env.demo data/guidance/demo/seed-guidance-demo.mjs
```

### Nạp dữ liệu vào MySQL unihub_demo:

```bash
node --env-file=backend/.env.demo data/guidance/demo/seed-guidance-demo.mjs --apply
```

### Xác minh dữ liệu đã nạp:

```bash
node --env-file=backend/.env.demo data/guidance/demo/seed-guidance-demo.mjs --verify
```

### Chạy trọn bộ kiểm thử:

```bash
# Kiểm thử toàn vẹn fixture
node --test data/guidance/demo/guidance-demo.test.mjs

# Kiểm thử an toàn DB guard & rollback
node --env-file=backend/.env.demo --test data/guidance/demo/safety-and-api-scenarios.test.mjs

# Kiểm thử API integration live
node --env-file=backend/.env.demo --test data/guidance/demo/guidance-api-integration.test.mjs
```
