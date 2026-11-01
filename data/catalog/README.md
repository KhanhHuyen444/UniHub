# Danh mục chuẩn ban đầu dùng chung

Bộ **11 Major + 19 Skill** được xuất từ `initial_catalog_proposal.categories` của batch v2 đã được leader duyệt trên `data/opportunities-initial`. File [initial-categories.json](initial-categories.json) chỉ chứa `type`, `name`; không chứa ID local, tài khoản, email, token, dữ liệu TEST-ADMIN hoặc cơ hội. Tên đã duyệt giữ nguyên: Quản trị nhân lực; không tạo Major rộng Quản trị/Kinh doanh; dùng ứng dụng riêng thay vì cộng thêm Office/Workspace cho cùng yêu cầu. File này không thay thế quy tắc liên kết kỹ năng bắt buộc/ưu tiên của từng tin.

Đối chiếu chỉ đọc ngày 31/10/2026: danh mục đã duyệt khớp chính xác database cá nhân (11 Major, 19 Skill; đều Active), không thiếu/thừa tên. Không nhập lại database đó. Bằng chứng local được giữ ngoài commit; không đưa database dump lên Git.

**Git chỉ chia sẻ file và code. Mỗi thành viên tự dry-run và nhập vào database riêng của mình.** Không chạy apply vào database nhóm nếu chưa được nhóm cho phép. ID do database đích sinh ra, có thể khác giữa các máy; consumer tìm theo `type + name`, không sao chép ID của người khác.

## PowerShell tại gốc repository

1. Dùng Node/npm đúng [README](../../README.md), cài dependency bằng `npm.cmd ci` nếu chưa cài. Chuẩn bị MySQL/database riêng theo [database runtime](../../docs/database-runtime.md) và [migration](../../docs/database-migrations.md). Cấu hình runtime trong `backend/.env`, migration account riêng trong `backend/.env.migration` theo tài liệu; không đưa hai file đó lên Git. Importer không tạo database, đổi quyền SQL hoặc tự chạy migration.
2. Kiểm tra migration. Chỉ deploy các migration đã có trên database đích được phép dùng; không chạy migrate reset/dev hoặc thay schema cho importer.

```powershell
# Tại gốc UniHub
npm.cmd run db:migrate:status
# Chỉ khi database riêng còn thiếu migration và đã xác nhận đúng đích:
npm.cmd run db:migrate:deploy
npm.cmd run build --workspace @unihub/backend
```

3. Dry-run mặc định, không ghi database:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only
# Tương đương, chỉ rõ file và chế độ:
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --file data/catalog/initial-categories.json --dry-run
```

`--file` tính từ thư mục đang chạy; đặt trong dấu ngoặc kép nếu đường dẫn có khoảng trắng. `--catalog-only` mặc định đọc `data/catalog/initial-categories.json` kể cả khi build. JSON phải là mảng không rỗng chỉ có `type/name`; importer từ chối ID, field lạ, loại sai, tên không hợp lệ và tên trùng sau chuẩn hóa. Không cần file batch 8 cơ hội, không truy vấn/ghi opportunities ở chế độ này.

Kiểm tra `mode: dry-run`, `writes: 0`, `plan.blocked: false` và từng action `create/reuse`. Database trống: 30 `create`; đã nhập đầy đủ: 30 `reuse`. Cùng tên khác type là hai danh mục riêng. Tên được so khớp NFC, trim/khoảng trắng và không phân biệt hoa/thường; không bỏ dấu hoặc gộp từ đồng nghĩa. `existingName` cho biết tên đang có; importer không đổi tên đó. Nếu nhiều tên cùng chuẩn hóa, type legacy sai hoặc danh mục không Active, action `blocked` kèm `reason`; dry-run kết thúc mã 2. Không tự chọn một bản ghi hoặc mở lại Closed.

4. Chỉ sau khi review kế hoạch, ghi với `--apply` rõ ràng:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --apply
if ($LASTEXITCODE -ne 0) { throw 'Import không thành công; kiểm tra lại dry-run, không tự sửa danh mục Closed.' }
```

Mọi bước lập lại kế hoạch và tạo mới nằm trong một transaction Serializable. Giữ nguyên hàng đã có; không update/delete/đổi tên/mở Closed. Gặp mục chặn hoặc lỗi ghi thì cả transaction rollback; xung đột đồng thời cũng thất bại an toàn. Chạy lại dry-run trước khi quyết định thử lại. Kết quả thành công có `created` và `reused`.

5. Kiểm tra sau khi nhập:

```powershell
node --env-file=backend/.env backend/dist/scripts/opportunities-import.js --catalog-only --dry-run
```

Phải không còn `create/blocked` cho bộ chuẩn. Một database có danh mục bổ sung hợp lệ vẫn được giữ nguyên; tổng danh mục toàn database có thể hơn 30. Có thể kiểm tra chỉ đọc bằng công cụ MySQL đã dùng sẵn:

```sql
SELECT type, status, COUNT(*) AS total FROM categories GROUP BY type, status;
SELECT type, name, status FROM categories ORDER BY type, name;
```

## Importer tái sử dụng và phạm vi

Chỉ có một importer: [opportunities-import.ts](../../backend/src/scripts/opportunities-import.ts). Chế độ catalog và batch cơ hội dùng chung `planCategories`/`writeCategories`. Full batch v2 cũ vẫn dùng `importOpportunities` và nhận file bằng `--file` (hoặc đường dẫn batch cũ nếu có ở checkout riêng); giữ nhận diện listing/detail + tracking, bỏ qua tin đã có kể cả Approved/Rejected và không sửa quan hệ. Bộ 8 cơ hội/nội dung UI đang bảo toàn không được xuất bản trong PR danh mục này. Không chạy full batch chỉ để lấy danh mục; deadline/source của cơ hội cần review riêng trước khi nhập.

## Kiểm thử

```powershell
npm.cmd run build --workspace @unihub/backend
node --test backend/test/catalog-import.test.mjs
# Chỉ runner này provision MySQL test mới, không đọc .env hay dùng DATABASE_URL:
node backend/test/run-opportunities-import-mysql.mjs --run-isolated
```

Runner cần MySQL 8.4 Windows binaries (mặc định `C:\Program Files\MySQL\MySQL Server 8.4\bin`; có thể đặt `IMPORTER_MYSQL_BIN` tới thư mục binary). Runner tạo tiến trình MySQL và 5 schema mới tại thư mục tạm, xác minh port/datadir/UUID/version, áp dụng migration hiện có và dừng tiến trình của nó khi xong. Không dùng DB cá nhân/nhóm, không GRANT/REVOKE. Credential test ngẫu nhiên chỉ ở memory/child environment, không in. Báo cáo JSON nằm trong datadir tạm, không đưa vào Git. Test thường thiếu cấu hình cô lập sẽ skip suite MySQL, không được tính là đã chạy SQL.

Kết quả kiểm thử thực tế và giới hạn: [catalog-import-validation.md](../../docs/catalog-import-validation.md).
