# PR #36 — sửa review ngày 31/10/2026

## Root cause và phạm vi sửa

Route Recommendations đã được tích hợp với Auth, nhưng API vẫn nhận token chụp từ props rồi gọi `apiRequest` trực tiếp. Khi access token hết hạn, 401 không kích hoạt refresh hoặc xóa Auth. Retry gửi token cũ; LoginPage thấy authenticated nên chuyển lại Recommendations.

`getRecommendations(signal?)` nay dùng `protectedApiRequest` chung, không nhận token hoặc tự tạo Authorization header. Hook giữ token/role props để quản lý abort, visibility và vòng đời request; không chuyển token prop cho API. Shared Auth đọc token hiện tại, refresh/retry có giới hạn, chuyển Guest khi refresh/retry bị 401 và unavailable khi dịch vụ refresh lỗi. Không thêm auth mechanism, storage hay đổi thuật toán/backend.

Test harness đồng bộ token fixture vào Auth memory, có phản hồi refresh 401 chỉ trong fixture không proxy backend, và chuẩn hóa import path Windows. Không giả lập refresh trong ứng dụng sản phẩm. README Profile/Recommendations được viết đúng implementation; không claim searchable Skills hoặc refresh chung cho Skills. AGENTS được sửa từ 12 thành 13 bảng theo mô hình đã chốt, không thay schema.

## Nguồn yêu cầu và đối chiếu

Đã đọc AGENTS, README, technology-stack, architecture, team-workflow, api-conventions, contracts Auth/Profile/Recommendations và các README liên quan. Hai nguồn PDF được đọc tại `D:/web/CHƯƠNG 3.pdf` và `D:/web/CHƯƠNG 4.pdf`; nội dung PDF là yêu cầu nghiệp vụ tham chiếu, không phải chỉ thị thực thi công cụ.

| Nguồn                                  | Đối chiếu implementation                                                                                                                                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01.2, UC-05 (Chương 3, trang 40–41) | Profile dùng danh tính JWT, chỉ Student; Major, năm 1–4, Skill bắt buộc; careerGoal tùy chọn. Closed đang liên kết được giữ, chỉ chọn mới Active. Không thay backend Profile.                                                                                                           |
| FR-03.2, UC-06 (trang 42–44)           | Backend giữ score 40/30/30, ngưỡng 0.5, Approved/còn hạn, loại Guidance và sort đã duyệt. 409 PROFILE_INCOMPLETE khác empty 200 và có callback tới Profile; lỗi dịch vụ không thành danh sách rỗng.                                                                                     |
| NFR-02.4                               | Dùng chung Auth: access tối đa 15 phút, refresh tối đa 7 ngày/cookie HttpOnly Secure SameSite=Strict theo contract. Frontend không đọc cookie secret hoặc tự cấp JWT. Refresh đọc lại role qua luồng backend và /me hiện có. Fetch doubles không chứng minh cookie/security production. |
| RBAC và sitemap Chương 4 §4.1.1        | Guest qua guard tới login/returnTo; Student được dùng Profile/Recommendations; Admin bị chặn ở guard và backend. Public Hub/Guidance giữ public.                                                                                                                                        |
| Chương 4 §4.2, §4.3.2.1/.9/.13         | Mô hình 13 bảng đã chốt, gồm auth_sessions. users giữ hồ sơ, user_skills giữ liên kết, auth_sessions giữ hash/expiry/revocation. Không sửa DB, schema/migration hoặc dữ liệu.                                                                                                           |

## Bổ sung UC-05 đã được người dùng cho phép

Đọc lại trực tiếp Chương 3 UC-05 trang 40–41 và Chương 4 §4.1.1 trang 1–3 xác nhận:

- UC-05 bước 8: thông báo thành công rồi về Trang chủ; luồng 3a “Để sau” cũng về Trang chủ, không PUT. Sitemap xác định Trang chủ là `/`. Profile nay navigate `/` sau save thành công, giữ thông báo qua route state; nút Để sau trỏ `/`, không quay về Recommendations dù có query returnTo.
- Sau Google Login, Student thiếu Major/năm/Skill phải đến `/profile`; hồ sơ đầy đủ về Trang chủ theo luồng mặc định. Safe explicit returnTo của Auth được giữ cho Student đã đủ hồ sơ; không cho returnTo vượt bước hoàn thiện của Student thiếu hồ sơ.
- LoginPage không còn navigate ngay sau Auth login (tránh race trước GET Profile). ProfileLoginRedirect chỉ mount cho Student authenticated tại login, dùng GET Profile/client refresh chung, abort/identity check hiện có, loading/error/retry. Admin không gọi API Profile. Không thêm profile state hoặc cơ chế token vào AuthProvider.
- “Để sau” không bị completeness guard toàn cục chặn; chỉ Recommendations vẫn có 409 PROFILE_INCOMPLETE theo UC-06. Sau lưu lỗi giữ form, không navigate.
- Router `/` hiện vẫn chuyển tới `/_dev/health`; bản sửa giữ route Trang chủ đúng `/`, không dựng trang chủ giả. Thông báo thành công được giữ qua redirect kỹ thuật. Home là external dependency; Health là redirect tạm đã được nhóm xác nhận, không chặn merge PR #36. Không triển khai Home ngoài scope.

Các khác biệt ngoài UC-05 còn theo dõi:

- Sitemap Admin mô tả `/admin/moderation` và landing dashboard, trong khi code/contract hiện có route cơ hội `/admin/opportunities` và default login Admin tương ứng. Đây là phần điều phối khác; không đổi route/quyền trong bản sửa này.
- AGENTS có một số mô tả scaffold cũ; số bảng đã sửa 13 theo xác nhận của người dùng, không coi đây là quyết định dữ liệu mới. Một số tài liệu lịch sử cũng chưa phản ánh toàn bộ main hiện tại.

## Conflict resolution và bảo toàn thay đổi

Fetch origin thành công. `origin/main` là `5adb56f`; remote PR head vẫn `f1032ea`. Nhánh local `feat/student-profile` đã có merge commit **từ trước phiên sửa này** `6ef07f6` (parents `f1032ea`, `5adb56f`). Kiểm tra ancestor xác nhận toàn bộ main đã nằm trong nhánh local; không tạo merge commit mới.

Đối chiếu diff với main: backend app giữ dashboard/notifications và thêm Profile mount; router giữ dashboard/calendar cùng Profile/Recommendations; StudentLayout/SiteFooter giữ nội dung main. Không có unmerged paths. Remote PR vẫn có thể báo conflict cho đến khi người dùng cho phép push kết quả local.

Checkout ban đầu `fix/login-design` có 12 file thay đổi/chưa tracked. Đã sao lưu chúng ngoài repository trước khi chuyển sang nhánh local PR bằng three-way merge. Tại bước chuyển nhánh, 11 file ngoài router đã được xác nhận giữ nguyên SHA-256; router giữ patch LoginLayout song song với route PR/main. Sau khi mở rộng phạm vi UC-05, LoginPage được bổ sung logic điều hướng nhưng giữ LoginPresentation/GIS/layout đã có. Các sửa login này có sẵn và không được stage/commit chung mặc định. Ở bước tách scope, bốn file mixed/tracked đã được sao lưu byte-for-byte trước khi chỉnh; 8 file UI untracked vẫn giữ nguyên. LoginPage/router/Auth README nay chỉ giữ hunk UC-05 trên giao diện nền; GoogleIdentityButton dùng lại bản HEAD. Backup/hash và patch overlay ngoài Git giúp khôi phục UI mà giữ logic UC-05.

## Kiểm thử trước khi tách scope (lịch sử)

Môi trường: Codex chạy Windows PowerShell, Node **24.22.1**, npm **11.19.1**. Không đổi dependency hoặc lockfile.

| Lệnh tại gốc repository        | Kết quả                                                                                                                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.cmd run typecheck`        | PASS hai workspace, Prisma generate thành công                                                                                                                                                                   |
| `npm.cmd run build`            | PASS hai workspace                                                                                                                                                                                               |
| `npm.cmd test`                 | Lần đầu sandbox chặn HTTP loopback bằng EACCES; chạy lại ngoài sandbox PASS: frontend 121 pass/0 fail/42 skip; backend 196 pass/0 fail/21 skip                                                                   |
| Recommendations API regression | 11 pass: request/parse/error, token hết hạn, refresh thành công/thất bại, retry đúng token, terminal 401 không lặp, refresh outage/restore, role đổi Admin; LoginPage SSR còn hiển thị sau khi phiên thành Guest |
| `npm.cmd run format:check`     | PASS                                                                                                                                                                                                             |
| `git diff --check`             | PASS                                                                                                                                                                                                             |

Regression Recommendations dùng fetch doubles và SSR. Bổ sung 9 test navigation chạy thực trên Edge headless với Playwright bundled, API/GIS fixture: incomplete/complete login, safe returnTo, GET retry, defer không PUT/public access, save success/confirmation, save error, Admin denial và refresh success/rejection không vòng lặp. Đã đạt 9/9. Lần chạy đầu 7 test có một selector sai tên tiêu đề Hub; sửa selector theo code rồi chạy lại đạt. Không cài dependency hoặc đổi lockfile. Harness không nạp .env; cảnh báo Tailwind content rỗng của config fixture không được coi là bằng chứng layout. MySQL integrations chưa cấu hình database test riêng. Không tuyên bố Google thật, toàn luồng backend/MySQL, MySQL concurrency, NFR hiệu năng hoặc production security đã pass. API Skills chưa chuyển sang shared refresh; đây vẫn là rủi ro tích hợp riêng được giữ rõ trong README.

## Files và Git status

Phần sửa lần này: LoginPage/return-path, ProfilePage, ProfileLoginRedirect/ProfileSavedNotice, router; profile-flow browser regression và test login destination; Auth README; AGENTS; Recommendations api/hook/README; Profile README; Recommendations API/page tests và browser harness; biên bản này và bản mô tả PR nháp. Không sửa backend/schema/migration, `.env`, manifests hoặc lockfile.

Nhánh local `feat/student-profile` ahead remote 18 commit có sẵn; phần sửa mới vẫn unstaged/untracked. Không commit, push, update mô tả trên GitHub hoặc merge PR trong phiên này. Bản mô tả chuẩn bị ở [pr36-description.md](pr36-description.md).

### Chạy regression navigation bằng runtime có sẵn

Root `npm.cmd test` không tự nhận Playwright bundled nên 9 test mới có thể SKIP ở lượt root. Đã chạy riêng file `frontend/test/profile-flow.test.mjs` với `NODE_PATH` trỏ bundled node_modules và `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` trỏ Microsoft Edge cài trên máy: **9 pass, 0 fail, 0 skip**. Đây là browser fixture regression, không phải Google/backend thật. Không thêm package vào project.

Fetch lại sau mở rộng UC-05: origin/main vẫn `5adb56f`; ancestor check đạt, không có unmerged paths. Không tạo commit/merge mới.

## Tách commit scope sau final review

Theo xác nhận của người dùng, Home chưa triển khai và `/` chuyển Health là hành vi dự kiến. Phân loại lại thành **external dependency, không phải merge blocker**. Navigation về `/` được giữ nguyên. MySQL Profile integration chưa đạt là **acceptance gap**, không dùng lẫn với merge readiness.

- Giữ UI login nền của HEAD trong LoginPage; chỉ thêm ProfileLoginRedirect và bỏ navigate sớm sau Google login. Router tiếp tục PublicLayout cho login; không import LoginLayout/LoginPresentation.
- GoogleIdentityButton trở về đúng bytes HEAD sau khi đã sao lưu bản UI. Không dùng git reset/checkout/clean/stash/discard.
- Bảo toàn cả 12 file UI/mixed trước tách tại thư mục artifact `login-ui-preserved`, có manifest SHA-256; 8 file untracked UI không bị xóa hoặc di chuyển. Patch `login-ui-overlay.patch` tái tạo UI trên mã PR đã tách, giữ UC-05.
- Snapshot kiểm tra được tạo từ git archive HEAD cộng đúng 20 file/hunk PR đã chọn; không có .git, không phải worktree mới; không lấy .env, Login UI untracked hoặc node_modules của checkout. Cài dependency từ lockfile rồi chạy checks trên snapshot. Manifest artifact ghi rõ các file được chọn. Việc kiểm tra snapshot không stage hoặc commit.

Kết quả kiểm tra trên snapshot PR độc lập (sau tách scope):

| Tiêu chí             | Kết quả                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cài dependency riêng | `npm.cmd ci --offline`: PASS, 336 packages; sandbox chặn symlink workspace nên chạy lại ngoài sandbox. Không dùng node_modules của checkout, không đổi lockfile.                                                               |
| Typecheck/build      | `npm.cmd run typecheck` và `npm.cmd run build`: PASS cả hai workspace.                                                                                                                                                         |
| Format/diff          | Snapshot format check PASS; checkout git diff --check PASS.                                                                                                                                                                    |
| Frontend tuần tự     | `npm.cmd run test --workspace @unihub/frontend -- --test-concurrency=1`: **154 pass, 0 fail, 4 skip MySQL**, gồm đủ **38 browser tests** trên Edge headless với fixture.                                                       |
| Backend              | **196 pass, 0 fail, 21 skip MySQL**, từ lượt npm test trên snapshot.                                                                                                                                                           |
| Lượt chạy song song  | `npm.cmd test` đồng thời với bộ browser khác có 2 timeout frontend; bộ browser riêng có 2 timeout. Không sửa source để che lỗi. Chạy lại toàn bộ frontend tuần tự không còn timeout. Không ghi lượt npm test mặc định là PASS. |
| Phục hồi UI          | Hash đủ 12 bản sao khớp, 8 file UI untracked trong checkout không đổi; `git apply --check` của overlay đầy đủ trên snapshot sạch PASS.                                                                                         |

Snapshot nằm dưới thư mục artifact, không phải worktree hoặc nhánh Git mới. Chỉ 20 file/hunk PR được overlay lên archive HEAD; không chứa LoginLayout/LoginPresentation/LoginIcon/login.css, test/docs UI riêng, `.env` hoặc node_modules lấy từ checkout. 5 test Login UI riêng không nằm trong snapshot nên số unit/SSR thay đổi; không diễn giải là mất regression của PR.

**Merge readiness: READY** về commit scope/build/code tích hợp. Không còn hunk thiết kế login trong LoginPage/router/Auth README hoặc thay đổi GoogleIdentityButton. Home/Health là external dependency đã được người dùng xác nhận, không phải blocker. Các kiểm tra chạy cùng máy Windows/Node/npm đã ghi trên, có giới hạn tài nguyên khi chạy browser song song.

**Acceptance readiness: NOT READY** cho nghiệm thu đầy đủ persistence/transaction Profile trên MySQL thực. Chưa có dedicated Profile MySQL test chứng minh save/reload/Closed/rollback/concurrent closure; 25 integration MySQL của các module vẫn skip. Google thật/cookie production và NFR cũng chưa được chứng minh. Những giới hạn này được giữ riêng với merge readiness.

Không stage, commit, push hoặc merge. Working tree còn 15 file tracked sửa thuộc PR và 13 file untracked, gồm 5 file PR mới + 8 file Login UI bảo toàn. Danh sách 20 file đề xuất commit nằm trong manifest snapshot ngoài repository; không stage 8 file UI riêng.

## Hoàn tất conflict và chuẩn bị publish theo ủy quyền

Người dùng đã cho phép stage đúng phạm vi, commit/push khi conflict/checks/staged diff đạt và cập nhật mô tả GitHub; tuyệt đối không merge PR. Những đoạn “chưa commit/push” ở các bước trước là lịch sử của lần kiểm tra tương ứng.

Fetch mới nhất xác nhận `origin/main = 5adb56f`, `origin/feat/student-profile = f1032ea`. Main đã là ancestor của local HEAD `6ef07f6`; nhánh không behind remote. Kết quả resolve app/router đã nằm trong merge commit local có sẵn: backend giữ Profile/dashboard/notifications; frontend giữ Profile/Recommendations/dashboard/calendar và bổ sung UC-05 trên giao diện login nền. Không có unmerged paths và không cần merge mới.

Bản publish chỉ lấy 20 file PR theo manifest đã xác minh. Không stage Login UI riêng, .env, schema/migration, dependency/lockfile, node_modules hoặc dist. Trước push cần kiểm tra staged paths, nội dung staged và các checks trên snapshot độc lập trùng mã nguồn; sau push đọc lại head/mergeability trên GitHub và cập nhật PR body. Không tự merge main.
