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

## Nullable deadlines in collector/importer v2

The importer accepts explicit `deadline: null` only with both metadata fields
`deadline_source_date: null` and `deadline_source_timezone: null`, plus
`evidence.source_status: "open"`. Missing fields, mixed metadata, closed or
unknown source status are rejected. A dated item still requires a future cutoff
and valid date/offset metadata. Calendar rollover dates are invalid.

Greenhouse/Lever successful public posting lists provide open-publication evidence;
explicit non-open states override it. A failed request provides no evidence.
Malformed or unresolved published deadlines go to review, never become null.
Scholarship configuration alone does not verify that applications are open.
Publication does not prove location, student suitability or catalog mapping.

Collector output uses `needs_review` on the catalog proposal, categories and links.
The importer retains its explicit leader-approval gate. Do not manufacture approval
just to run a batch. Source evidence must be rechecked before leader approval;
null means no published deadline, not a guarantee that applications stay open.

Schema already permits all three NULL fields; no migration is needed. Admin
approval does not require a deadline. Public Hub/Detail omit null dates/countdowns;
Recommendations accepts NULL and sorts it after known dates on equal scores.
The 40/30/30 scoring formula is unchanged.

Validation on 02/11/2026 (Windows Node 24.22.1): live public API lists returned
Axon 471, Canonical 314, Palantir 301, Coupa 40 postings with no published date:
785 Greenhouse + 341 Lever newly pass the deadline check. These are pre-dedup
counts, not import-ready counts. With repository catalog fallback, 54 proposals
remained; 756 failed catalog matching and 316 were internal duplicates (per source).
No MySQL deduplication or student/location suitability verification was performed
for these live counts. Existing output files were preserved.

Importer CLI dry-run against the existing four-item dated batch: writes=0,
blocked=false, 24 categories reused, 4 planned creates. NULL dry-run uses synthetic
unit fixtures with a read-only fake client; collector proposals remain unapproved.

### Student audience and Vietnam eligibility gates

Collector proposals now require an Intern/Fresher/Graduate/Junior/entry-level title.
Senior/Lead/Manager/Staff/Principal/Director/Head titles are excluded from proposals.
Experience requirements exceeding two years go to review; Junior without clear
experience requirements also needs review. These conservative keyword gates do
not replace human JD review. Unrecognized language/requirements remain candidates
for manual assessment, never grounds for inventing eligibility.

Location must explicitly name Vietnam/a recognized Vietnamese city, or explicitly
state worldwide/global remote eligibility. Remote US/Europe/UK and explicit foreign
residence/work-authorization restrictions do not qualify; Remote/APAC alone is
insufficient. No inference from the employer having a Vietnam office.

Both Major and Skill must match JD sections in the active catalog. Missing Major
or Skill generates NO_JD_MAJOR_MATCH / NO_JD_SKILL_MATCH; no empty Skill proposal,
no automatic new category and no fixed scholarship mapping fallback. English JD
terms without an exact catalog match still require manual mapping; proposals are
not verified mappings and require leader review before importer execution.

After the audience/location/JD gates, a fresh live read returned Axon 0,
Canonical 1, Palantir 0 and Coupa 0 proposals (1126 postings read).
The remaining proposal is Canonical Graduate Sales Development Representative,
location Home based - Worldwide, source job 5915299. Its lexical Marketing/Linux
mapping remains needs_review; keyword presence alone does not establish that a
Major/Skill is required for the role. No proposal is approved or imported.
These counts use repository catalogs without MySQL deduplication.

Source coverage expansion, reviewed-page CLI, per-source rates and current proposal files: [ETL source coverage](etl-source-coverage.md).
