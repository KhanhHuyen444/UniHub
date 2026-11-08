# Nạp demo UniHub theo từng bước

Chạy sau [migration, GRANT, build, Google Login và bootstrap Admin](../README.md). Mọi lệnh tại gốc repo. Dùng `backend/.env` runtime đã tự cấu hình, không phụ thuộc `.env.demo` của thành viên. Không có script seed tổng được xác nhận an toàn cho toàn bộ chuỗi; hướng dẫn này là danh sách lệnh được chọn từ source hiện tại.

## 1. Điểm dừng trước khi truy cập database

Operator phải xác minh trong trình soạn thảo cục bộ rằng URL runtime trỏ MySQL loopback và schema `unihub_demo` **do mình sở hữu/được phép ghi**. Với MySQL client cục bộ, dùng tài khoản runtime để kiểm tra chỉ đọc:

```sql
SELECT DATABASE() AS target_database, CURRENT_USER() AS runtime_account;
SHOW GRANTS FOR CURRENT_USER;
```

Chọn đúng database `unihub_demo` khi mở kết nối. Dừng nếu tên khác, không rõ chủ sở hữu, quyền chưa đúng hoặc database đang có dữ liệu cần bảo toàn. Tên `unihub_demo` giống nhau không chứng minh đó là database mới; không lấy kết quả máy nhóm làm bằng chứng cho máy người nhận. Không seed lên database khác để thử guard.

Mỗi khối dry-run và apply bên dưới là **hai bước riêng**. Chỉ chạy apply khi vừa review kế hoạch không bị chặn, không có xung đột và người vận hành xác nhận được phép ghi đúng đích. Không dán chạy liền toàn bộ trang. `$LASTEXITCODE` khác 0 thì dừng, không tiếp tục bộ tiếp theo. Chạy một seed tại một thời điểm, không chạy đồng thời với thay đổi catalog/nội dung của người khác.

```powershell
npm.cmd run build --workspace @unihub/backend
```

## 2. Phạm vi, guard và khả năng chạy lại

Ứng dụng có thể chạy với database không có nội dung. **Catalog là prerequisite bắt buộc của toàn bộ demo**; Cơ hội, Guidance, Forum là các bộ nội dung tùy chọn khi chỉ thử kết nối, nhưng cần đủ ba để nghiệm thu demo tương ứng. Bộ cơ bản 30 danh mục chưa đủ cho demo đầy đủ.

| Bộ                                  | Dry-run / ghi                                                         | Guard thực tế                                                                           | Chạy lại và giới hạn                                                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog (importer `--catalog-only`) | Mặc định dry-run; `--dry-run` / `--apply` rõ ràng                     | Không có guard tên schema; operator xác minh đích trước                                 | `type + name` chuẩn hóa; create/reuse, chặn Closed/ambiguous/type sai; không đổi hàng cũ; transaction Serializable                                                                      |
| 100 Cơ hội (cùng importer)          | Mặc định dry-run; `--dry-run` / `--apply`                             | Không có guard tên schema; có gate phê duyệt batch/category/link và validation deadline | Skip tin trùng source detail hoặc publisher/title kể cả Approved/Rejected; không sửa quan hệ/nội dung cũ; validate toàn batch trước skip, nên batch hết hạn vẫn bị từ chối khi chạy lại |
| Guidance                            | Không truyền cờ là dry-run; `--apply`; `--verify` chỉ đọc             | `SELECT DATABASE()` phải là `unihub_demo`, thêm kiểm tra URL chứa tên DB cũ             | Reuse theo title + publisher định hướng; không đồng bộ bài cũ hoặc sửa nội dung/quan hệ; plan trước transaction, tránh chạy đồng thời                                                   |
| Forum                               | Không truyền cờ là dry-run; `--apply`; không có CLI verify-only riêng | `SELECT DATABASE()` phải là `unihub_demo`                                               | Keep tác giả theo email **hoặc** google_sub, bài theo author/title, bình luận theo post/author/content; không khôi phục soft-delete; tránh chạy đồng thời                               |

Guidance/Forum không có prompt tương tác; `--apply` là quyết định ghi của operator. Kiểm tra sau apply chạy **sau commit**: verify lỗi không có nghĩa toàn bộ seed rollback. Trước khi thử lại, đọc kết quả dry-run và truy vấn chỉ đọc, không xóa/reset. Forum có thể reuse nhầm danh tính khi email/sub fixture đụng user thật; nếu gặp collision trong database không mới thì dừng để review, không nhập tiếp hoặc sửa danh tính người dùng.

## 3. Catalog — làm đủ bốn file theo thứ tự

Với mỗi file: dry-run → kiểm tra → apply → dry-run lại. Những file sau bổ sung phần thiếu và reuse tên đã có.

### 3.1. Bộ cơ bản

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/catalog/initial-categories.json --dry-run
```

Kỳ vọng `mode: dry-run`, `writes: 0`, `plan.blocked: false`, 30 create trên catalog trống (11 Major + 19 Skill). Chỉ khi đã review/xác nhận đích:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/catalog/initial-categories.json --apply
if ($LASTEXITCODE -ne 0) { throw 'Dừng seed: catalog cơ bản chưa thành công.' }
```

### 3.2. Ngành mở rộng

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/catalog/expanded-majors.json --dry-run
```

Review từng action, không blocked; chỉ sau xác nhận:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/catalog/expanded-majors.json --apply
if ($LASTEXITCODE -ne 0) { throw 'Dừng seed: ngành mở rộng chưa thành công.' }
```

### 3.3. Kỹ năng mở rộng

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/catalog/expanded-skills.json --dry-run
```

Review từng action, không blocked; chỉ sau xác nhận:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/catalog/expanded-skills.json --apply
if ($LASTEXITCODE -ne 0) { throw 'Dừng seed: kỹ năng mở rộng chưa thành công.' }
```

### 3.4. Snapshot đầy đủ

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/opportunities/demo/catalog.json --dry-run
```

Snapshot bổ sung Major **Kinh doanh số và trí tuệ nhân tạo** thiếu trong ba bộ trước. Sau review/xác nhận:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/opportunities/demo/catalog.json --apply
if ($LASTEXITCODE -ne 0) { throw 'Dừng seed: snapshot chưa thành công.' }
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/opportunities/demo/catalog.json --dry-run
```

Kỳ vọng lần cuối **445 reuse**, không create/blocked. Trên database mới chỉ dùng các bộ trên: 117 Major + 328 Skill Active. Database có danh mục bổ sung có thể có tổng lớn hơn; không xóa để ép tổng. Guidance verify có kỳ vọng 117 Major, nên catalog mở rộng ngoài bộ chuẩn có thể làm verify thất bại sau commit.

```sql
SELECT type, status, COUNT(*) AS total
FROM unihub_demo.categories GROUP BY type, status;
```

Nếu blocked, đọc `reason` từng hàng; không tự mở lại Closed hoặc thay tên/ID để vượt gate. Mapping `major-skill-mapping.json`/`major-career-skills.json` là tài liệu dữ liệu, không phải script tạo bảng hoặc seed riêng.

## 4. Cơ hội synthetic — Pending rồi duyệt qua Admin

`batch-proposal.json` hiện có proposal/category/link `leader_approved`; nội dung tin vẫn Pending, `is_verified=false`, reviewer NULL. Phê duyệt batch nhập liệu khác phê duyệt xuất bản. 100 URL thuộc `unihub-demo.invalid` không hoạt động, không phải tin thật để ứng tuyển.

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --file data/opportunities/demo/batch-proposal.json --dry-run
```

Trên đích mới sau catalog: kỳ vọng 100 create, 280 category reuse, 0 category create, `writes: 0`, `blocked: false`. Batch có 40 thực tập, 35 việc làm, 25 học bổng; 80 deadline cụ thể và 20 NULL có evidence open. Importer kiểm tra deadline > thời điểm chạy, metadata/cutoff, source identity, năm học, catalog và phê duyệt. Nếu hết hạn hoặc validation lỗi, **dừng bộ Cơ hội**, báo leader review fixture; không sửa đồng hồ, deadline, metadata hoặc trạng thái để vượt kiểm tra. Các bộ Guidance/Forum độc lập có thể được tiếp tục sau catalog, nhưng ghi phần Cơ hội chưa nghiệm thu.

Chỉ sau dry-run hợp lệ và xác nhận ghi:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --file data/opportunities/demo/batch-proposal.json --apply
if ($LASTEXITCODE -ne 0) { throw 'Dừng bộ Cơ hội: import chưa thành công.' }
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --file data/opportunities/demo/batch-proposal.json --dry-run
```

Kỳ vọng apply mới `created: 100`, `skipped: 0`; dry-run lại 100 `skip_existing`. Admin tại `/admin/moderation` xem từng tin và duyệt tin demo được chọn. Public Hub chỉ hiển thị cơ hội Approved còn phù hợp deadline/filter. Recommendations còn phụ thuộc hồ sơ Student (Major/năm/Skill) và threshold; không hứa 100 tin hiển thị ngay sau seed.

```sql
SELECT opportunity_type, status, COUNT(*) AS total
FROM unihub_demo.opportunities
WHERE source_url LIKE 'https://unihub-demo.invalid/%'
GROUP BY opportunity_type, status;
```

## 5. Guidance

```powershell
node --env-file=backend/.env data/guidance/demo/seed-guidance-demo.mjs
```

Kỳ vọng trên đích mới: 146 create, 0 reuse, `appliedCount: 0`. Review catalog và đích, rồi xác nhận ghi:

```powershell
node --env-file=backend/.env data/guidance/demo/seed-guidance-demo.mjs --apply
if ($LASTEXITCODE -ne 0) { throw 'Dừng bộ Guidance: kiểm tra cả seed và verify sau commit.' }
node --env-file=backend/.env data/guidance/demo/seed-guidance-demo.mjs --verify
node --env-file=backend/.env data/guidance/demo/seed-guidance-demo.mjs
```

Kỳ vọng verify 146 bài, 100 Major có bài, 17 Major empty state; dry-run lại 0 create/146 reuse. Đây là bài định hướng system-preloaded Approved, không phải lộ trình cá nhân hóa hay tin tuyển dụng; không xuất hiện trong Hub cơ hội. Reuse không sửa nội dung cũ, verify không so sánh đầy đủ mọi field/quan hệ với fixture.

## 6. Forum

```powershell
node --env-file=backend/.env data/forum/demo/seed-forum-demo.mjs
```

Kỳ vọng mới: 12 authors, 24 posts, 136 comments cần tạo. Review collision/danh tính/đích, rồi xác nhận ghi:

```powershell
node --env-file=backend/.env data/forum/demo/seed-forum-demo.mjs --apply
if ($LASTEXITCODE -ne 0) { throw 'Dừng bộ Forum: kiểm tra cả seed và verify sau commit.' }
node --env-file=backend/.env data/forum/demo/seed-forum-demo.mjs
```

Apply mới tạo 12/24/136, kiểm tra fixture ngay sau commit; dry-run lại không cần tạo thêm. Có 8 bài mỗi chủ đề. Nếu nội dung đã bị soft-delete, seed giữ trạng thái đó; post-verification kỳ vọng toàn bộ fixture hoạt động có thể lỗi dù dữ liệu được giữ đúng. Không un-delete hoặc apply lặp để ép verify đạt. Tác giả mẫu dùng sub giả lập, không có Google Login hợp lệ; dùng tài khoản thật riêng cho nghiệm thu tương tác.

## 7. Script ngoài luồng cài mới

| Script / nhóm                                                                          | Vì sao không chạy trong Quick Start                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seed-dev-opportunities.mjs`, `seed-major-coverage.mjs`                                | Ghi/update ngay, thay quan hệ và có thể đặt Approved/verified; không có guard schema/dry-run như luồng trên                                                                                           |
| `sync-db-realistic.mjs`                                                                | Gọi main ngay, update nội dung DB; không phải seed mới                                                                                                                                                |
| `sync-data-refinement.mjs`                                                             | Có chế độ apply nhưng sửa nội dung/quan hệ/trạng thái; không phải import bảo toàn bản ghi                                                                                                             |
| `verify-reproducible-seed.mjs`                                                         | Đọc file env riêng, tự đổi tên đích/chạy migration/seed cũ; truyền `{ dryRun: false, strict: true }` cho importer trong khi API hiện dùng `{ apply: true }`, nên không chứng minh chuỗi mới hoạt động |
| `build-demo.mjs`, `generate-realistic-data.mjs`                                        | Công cụ tạo/sửa fixture và metadata; build-demo đọc DB, ghi lại artifact; không cần chạy để dùng fixture đã commit                                                                                    |
| `generate-guidance-demo.mjs`                                                           | Tên lịch sử có chữ generate, nhưng CLI hiện tại chỉ đọc/validate fixture và thống kê; có thể dùng để kiểm tra offline, không ghi DB                                                                   |
| `generate_master_guidance.py` và các module Python nội dung; `generate-forum-demo.mjs` | Tạo/ghi fixture; không cần Python để cài app hoặc seed fixture hiện có                                                                                                                                |
| `sync-guidance-content.mjs`                                                            | Guard demo, dry-run mặc định nhưng apply cập nhật bài hiện có; dành cho đợt sửa nội dung riêng                                                                                                        |
| `safety-*`, `guidance-api-integration.test.mjs`                                        | Có kết nối live, test safety có thao tác ghi/rollback; không dùng DB đang có dữ liệu cần giữ                                                                                                          |

Không thêm coordinator gọi các script cũ: guard tên DB chưa đủ bảo vệ database có dữ liệu, verify sau commit và thao tác update có tác động khác nhau. Không thay đổi nghiệp vụ/schema trong đợt bàn giao tài liệu. Chi tiết source và README từng bộ: [Catalog](../data/catalog/README.md), [Cơ hội](../data/opportunities/demo/README.md), [Guidance](../data/guidance/demo/README.md), [Forum](../data/forum/demo/README.md).
