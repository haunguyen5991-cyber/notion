# Tìm kiếm tài sản — Database chung

Một ô tìm kiếm luôn hiện; nhập tên/địa chỉ, chọn kết quả và mở hồ sơ gốc. Không gửi form, không sửa dữ liệu, không tạo database mới.

## Nguồn và phạm vi

- Data source cố định: `38f6bd68-5348-8029-b8a2-000b30978089` — Database chung.
- Đọc qua Notion API `2026-03-11`, có phân trang.
- Chỉ yêu cầu `Name`, `Tên đường`, `Quận cũ`, `Phường hiện hành`, `Tình trạng`, `Giá bán (đ)`, `Cấp hiển thị`, `Ngày bắt đầu gói`, `Ngày hết hạn gói`.
- **Chỉ trả bản ghi có `public_url` HTTPS hợp lệ.** Không dùng `url` đăng nhập làm phương án dự phòng. Nếu tài sản công khai kế thừa nhưng API không trả `public_url`, tài sản đó sẽ không xuất hiện; cần kiểm tra bằng token thật sau triển khai, không nới chặn bảo mật để lấp kết quả.
- Kết quả tìm chỉ nhận tên, quận, tình trạng và URL công khai. Danh sách ưu tiên thêm giá bán công khai; không trả cấp/ngày gói hoặc dữ liệu liên hệ.
- Chỉ mục tìm kiếm được làm mới tự động từ Notion bằng lịch Cloudflare mỗi 2 phút. KV là bộ nhớ đệm dẫn xuất, không phải database nguồn thứ hai; giá trị tự hết hạn sau 10 phút. Máy chủ không phục vụ bộ nhớ đệm quá 3 phút. Khi trang đang mở và có từ khóa, kết quả tự tải lại mỗi 2 phút. Không ghi snapshot vào GitHub, không cập nhật đẩy tức thì.
- Khi chọn tài sản, mở URL hồ sơ gốc (thông tin hồ sơ do Notion phục vụ).

## Triển khai nhanh trên dashboard Cloudflare

Tạo Worker riêng tên `dulieunhapho-search`, mở Edit code, thay mã mẫu bằng toàn bộ nội dung tệp **`worker.mjs`** rồi Deploy; thêm binding KV `SEARCH_CACHE` và lịch `*/2 * * * *`. Đây là bản gộp sẵn, không cần cài thư viện. Sau đó thêm Secret `NOTION_API_TOKEN` theo hướng dẫn bên dưới. Không thay mã của Worker/website đang dùng.

## Triển khai một lần bằng Wrangler trên Cloudflare Workers

Đây là **Cloudflare Worker**, không phải Notion Worker hay Worker database sync. Có thể dùng tài khoản Cloudflare đã quản lý website; chỉ gắn Custom Domain `timkiem.dulieunhapho.com`; không thay DNS của tên miền gốc/www, email, website hiện tại hoặc các file HTML khác.

1. Trong thư mục `property-search`: chạy `node build.mjs`, `npm test`; cài `npm install` nếu dùng Wrangler.
2. Đăng nhập Cloudflare bằng Wrangler, chạy `npm run deploy` để tạo Worker riêng `dulieunhapho-search`.
3. Tạo Secret `NOTION_API_TOKEN` cho Worker:
   - Dashboard: Workers & Pages → `dulieunhapho-search` → Settings → Variables and Secrets → Add → **Secret**.
   - Hoặc chạy `npx wrangler secret put NOTION_API_TOKEN`; nhập token tại lời nhắc bảo mật, không đưa giá trị vào lệnh.
4. Kết nối Notion của token chỉ cần **Read content** và được chia sẻ **Database chung**. Không cấp quyền sửa/thêm.
5. Mở URL Worker **do Cloudflare trả về**, thử tìm cả có dấu/không dấu, kiểm tra bản ghi đã công khai, và kiểm tra bản ghi riêng tư không xuất hiện.
6. Nhúng chính URL Worker đó vào trang Notion bằng block Embed. Không nhúng file `src/index.html` độc lập vì nó cần API cùng nguồn `/api/search`.

Chưa cấp Secret thì trang vẫn mở được nhưng tìm kiếm trả lỗi chung, không trả dữ liệu giả. Mã không chứa token. Không đưa token vào GitHub, HTML, README hoặc trường `vars` của Wrangler.

## Kiểm thử

`npm test` chạy kiểm thử với dữ liệu tổng hợp, không gọi Notion thật. Cần kiểm thử tích hợp sau khi đã cấp Secret và triển khai. Lượt khởi tạo chỉ mục đầu tiên phải đọc nhiều trang API nên có thể chậm; lịch làm mới và KV tránh lặp việc này trên mỗi lượt tìm. Namespace KV dành riêng cho dịch vụ này, tên `dulieunhapho-search-cache`. Giới hạn bảo vệ 30 trang API; vượt giới hạn sẽ báo lỗi thay vì trả thiếu dữ liệu. Không lưu log từ khóa hoặc IP; giới hạn 40 lượt/phút/IP chỉ có hiệu lực trong từng isolate. Với lưu lượng lớn cần bổ sung giới hạn ở lớp Cloudflare.

## Hoàn tác

Mã nằm trên nhánh `feat/tim-kiem-tai-san`, không thay `main`. Nếu đã triển khai, gỡ block Embed và xóa Worker riêng; không ảnh hưởng Database chung hoặc website khác.

## Tài liệu

- https://developers.notion.com/reference/query-a-data-source
- https://developers.notion.com/guides/get-started/internal-connections.md
- https://developers.cloudflare.com/workers/configuration/secrets/

## Địa chỉ triển khai

Địa chỉ chính: https://timkiem.dulieunhapho.com/

Địa chỉ workers.dev dự phòng vẫn hoạt động: https://dulieunhapho-search.haunguyen5991.workers.dev/

Cloudflare quản lý DNS và chứng chỉ HTTPS cho riêng subdomain tìm kiếm. Khối Embed dùng địa chỉ chính; không đổi bố cục hoặc dữ liệu nguồn.

API tìm kiếm: `/api/search?q=...`. Không cần gửi token ở trình duyệt.

## Quy tắc tìm gần đúng

- Chuẩn hóa có/không dấu và p, p., phường; q, q., quận.
- Phường chỉ đối chiếu Phường hiện hành trong nguồn; không suy phường cũ từ tiêu đề.
- Tìm đủ các thành phần đã nhập, ưu tiên khớp chính xác; cho phép sai một ký tự (thiếu/thừa/đổi/đảo hai chữ liền kề) trên tối đa hai từ. Từ ngắn cần ít nhất hai thành phần khớp làm ngữ cảnh.
- Số nhà, số phường/quận và mã có chữ-số phải khớp nguyên từ, không sửa gần đúng.
- Chỉ mục KV v2 bổ sung khóa phường và từ tách sẵn; không đổi dữ liệu nguồn hoặc trường công khai trả về.

## Ba căn mặc định

Ô trống gọi `/api/featured`, chọn tối đa 3 hồ sơ công khai đang bán, gói còn hiệu lực. Premier trong 7 ngày đầu đứng trước Signature (bao gồm Premier sau 7 ngày), rồi Priority; đồng cấp sắp tên tự nhiên. Premier thiếu ngày bắt đầu hoặc hết hạn không đủ căn cứ ưu tiên; Signature/Priority cần ngày hết hạn, nếu có ngày bắt đầu trong tương lai thì không chọn. Ngày thuần được tính lúc 00:00 theo UTC+7; hết hạn là mốc loại. Không bù Standard hoặc hồ sơ riêng tư. Cấp hiệu lực được tính lại lúc trả kết quả, không lưu cứng ba ID. Danh sách có tên, giá bán (nếu có), quận; ô luôn cố định, chỉ danh sách cuộn. Gõ từ khóa thay danh sách; xóa thì tải lại mặc định. Không thêm dòng đếm.
