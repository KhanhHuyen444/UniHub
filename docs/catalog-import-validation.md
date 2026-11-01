# Kiểm thử chia sẻ danh mục ban đầu — 31/10/2026

Phạm vi: tái sử dụng `opportunities-import.ts`, thêm `--catalog-only` và file chỉ type/name (11 Major, 19 Skill). Không thay schema/migration/quyền SQL, không chia sẻ batch cơ hội/dump/ID local. Không chạy apply vào database cá nhân/nhóm.

## Kiểm tra dữ liệu

- Xuất từ batch v2 `initial_catalog_proposal` và từng entry đều `leader_approved`, lấy từ bản Opportunities được bảo toàn. Không tự thêm/gộp tên.
- Đối chiếu chỉ đọc với database cá nhân: 11 Major, 19 Skill; cùng type/name chính xác, Active; thiếu/thừa/Closed đều 0.
- CLI dry-run thực tế trên database cá nhân: `--catalog-only` mặc định dry-run, writes 0, create 0, reuse 30, blocked false. Báo cáo có ID local giữ ở cache, không commit.

## Kiểm thử tự động

Unit tests dùng delegate doubles, không phải bằng chứng SQL: validation chỉ type/name, dry-run không transaction/write/opportunity access, lần đầu/lặp lại, type+name, giữ tên cũ, Closed/ambiguous/type sai, rollback và parsing CLI. Regression mode batch dùng cơ hội tổng hợp chỉ trong unit test để bảo vệ nhận diện listing/detail, tracking và tin đã xử lý; không nhập fixture đó vào sản phẩm.

MySQL thật dùng runner tách tiến trình, 5 schema mới, áp dụng migration của repo; guard host/port/datadir/UUID/version. Kiểm tra:

- Dry-run không đổi snapshot.
- Apply tạo đúng 11 Major + 19 Skill; không tạo cơ hội, quan hệ, user hoặc activity log.
- Apply lại: created 0, reused 30; snapshot giữ nguyên; dry-run sau không tạo mới.
- Danh mục có sẵn được tái sử dụng đúng type+name, không đổi ID/tên/status; tên giống nhưng type khác giữ riêng. Hai tin Approved/Rejected và liên kết fixture trong DB cô lập giữ nguyên.
- Closed chặn toàn bộ transaction, không mở lại, không để các mục khác được tạo dở.
- Lỗi UNIQUE thật (P2002) ở lệnh create thứ ba bằng Prisma query extension trong test: hai insert trước rollback; snapshot toàn database giữ nguyên. Không đổi schema hoặc tạo endpoint gây lỗi.
- CHECK hiện có từ chối type sai; importer không bypass constraint. Phòng vệ legacy type sai/ambiguous được kiểm tra thêm bằng unit double vì schema hiện hành không cho tạo loại sai.

Lượt đầu có hai fixture sai schema (thiếu publisher, type lowercase bị CHECK chặn); đã sửa fixture theo ràng buộc thực tế, không đổi schema. Lượt cuối trên MySQL **8.4.13: 9 pass, 0 fail, 0 skip** (8 subtest và parent). Bao gồm chạy CLI thật mặc định dry-run → `--apply` tạo 30 → `--apply` lần hai tạo 0 → `--dry-run` chỉ reuse 30, tất cả trên schema cô lập.

Unit riêng: **9 pass, 0 fail/skip**. Root typecheck/build/format và diff-check đạt. Backend suite: **183 pass, 20 skip, 0 fail**; các ca thiếu cấu hình SQL không được tính là đã chạy. Frontend suite ban đầu bị sandbox chặn `tsx` (`uv_os_get_passwd/ENOMEM`); chạy lại ngoài sandbox đạt **93 pass, 32 skip, 0 fail**. Không thay code frontend để xử lý lỗi môi trường đó.

## Giới hạn

Không chạy UI, không tạo tài khoản/token, không kiểm thử NFR hoặc kết luận concurrency nhiều máy đã đạt. Serializable + UNIQUE giúp xung đột abort toàn bộ; khi gặp lỗi phải kiểm tra dry-run lại. Full import 8 cơ hội không được chạy trên DB cá nhân/nhóm trong nhiệm vụ này.
