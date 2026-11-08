# 100 Opportunities DEMO/SYNTHETIC

Đây là cơ hội giả lập cho đồ án, không phải tuyển dụng/học bổng thật. URL thuộc `unihub-demo.invalid` cố ý không hoạt động; không dùng để ứng tuyển, thu phí hoặc xác minh doanh nghiệp thật.

## Trạng thái hiện tại

`batch-proposal.json` có `initial_catalog_proposal.status`, category và link là `leader_approved`. Mỗi cơ hội vẫn **Pending**, `is_verified=false`, reviewer/time NULL. Phê duyệt batch cho phép importer kiểm tra/nhập; Admin phải duyệt riêng qua ứng dụng để xuất bản. Báo cáo `needs_review`/`NOT READY` trong artifact review cũ là lịch sử, không phải trạng thái JSON hiện tại hoặc database người nhận.

| Nội dung                |                     Số lượng |
| ----------------------- | ---------------------------: |
| Thực tập                |                           40 |
| Việc làm Fresher/Junior |                           35 |
| Học bổng                |                           25 |
| Deadline cụ thể / NULL  |                      80 / 20 |
| Major được dùng         |                          101 |
| Skill được dùng         | 179 trong snapshot 328 Skill |

Ngày 07/11/2026, validation offline qua `validateBatch` hiện tại đạt: 100 tin, không deadline hết hạn; khoảng deadline cụ thể từ `2027-01-01T17:00:00Z` đến `2027-04-09T17:00:00Z`. Đây không phải dry-run trên MySQL hoặc bằng chứng đã import. Luôn kiểm tra lại ở thời điểm thực thi; importer từ chối cả batch nếu có deadline hết hạn. Không sửa trạng thái, tự gia hạn hoặc chạy generator để vượt validation.

## Cài mới

Theo [README](../../../README.md), tạo `unihub_demo`, migration, GRANT runtime, build, đăng nhập Google và bootstrap Admin. Theo [seed workflow](../../../docs/demo-seed-workflow.md), nạp đủ bốn catalog trước, xác minh đúng database thuộc người nhận và review kế hoạch trước apply.

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --file data/opportunities/demo/batch-proposal.json --dry-run
```

Trên đích mới có catalog đầy đủ: 100 create, 280 category reuse, 0 category create, `blocked: false`, `writes: 0`. Importer không có guard tên database; kiểm tra đích là bước bắt buộc của operator. Chỉ sau dry-run hợp lệ và xác nhận quyền ghi:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --file data/opportunities/demo/batch-proposal.json --apply
```

Apply mới kỳ vọng `created: 100`, `skipped: 0`; chạy lại dry-run để kiểm tra skip_existing. Tin cũ kể cả Approved/Rejected được giữ nguyên, không cập nhật quan hệ. Validation toàn batch vẫn chạy trước skip. Public Hub/Recommendations chưa hiển thị Pending; Admin duyệt từng tin được chọn tại `/admin/moderation` rồi kiểm tra deadline/filter/hồ sơ Student.

## Files và công cụ bảo trì

- `catalog.json`: snapshot 117 Major + 328 Skill, chỉ `type/name` để import catalog.
- `batch-proposal.json`: batch importer v2 hiện hành.
- `reviewed-mapping.json`: mapping ngành/kỹ năng, nhiệm vụ và lý do từng tin.
- `coverage.json`, `scenarios.json`: độ phủ và tình huống giả lập; không tạo user/profile đăng nhập.
- `report.json`, `dry-run-result.json`, `final-review.md`, `mapping-fix-review.md`, `database-setup.md`: artifact/báo cáo tại thời điểm tạo; không dùng thay validation/đích hiện tại.
- `build-demo.mjs`, `generate-realistic-data.mjs`: công cụ tạo/sửa artifact; không cần chạy khi cài mới.
- Các script `seed-dev-*`, `seed-major-*`, `sync-*`, `verify-reproducible-seed.mjs`: ngoài luồng cài mới; xem [rủi ro từng script](../../../docs/demo-seed-workflow.md#7-script-ngoài-luồng-cài-mới).

## Recommendations và kiểm thử

Giữ công thức 40% Major + 30% Year + 30% Skill, threshold 0.5. Học bổng không giới hạn năm có yearMatch=0, khớp Major và mọi Skill cho điểm 0.7. Scenario chỉ là kỳ vọng giả định tin đã duyệt, không tạo tài khoản hoặc bỏ qua auth/RBAC.

Kiểm tra fixture/service không nạp `.env` hoặc truy cập MySQL:

```powershell
npm.cmd run build --workspace @unihub/backend
node --test data/opportunities/demo/demo.test.mjs backend/test/catalog-import.test.mjs backend/test/recommendations.test.mjs
```

Đọc [báo cáo rà soát](../../../docs/fresh-install-review.md) cho kết quả thực tế. Không chạy generator, sync hoặc live/safety test vào database đang có dữ liệu cần giữ.
