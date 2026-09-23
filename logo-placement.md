# Thông số đặt logo Thiên Hào

Tài liệu này ghi lại cấu hình logo đang sử dụng trong trang `Bcons_Uni_Valley.html` để có thể áp dụng lại cho các trang gallery hoặc landing page khác.

## Asset

- **File:** `thien-hao-dragon-logo-shadow.png`
- **Định dạng:** PNG RGBA, nền trong suốt
- **Kích thước gốc:** 2176 × 1632 px
- **Đường dẫn dùng trong HTML:** `./thien-hao-dragon-logo-shadow.png`

## Vị trí và kích thước

Logo được đặt tuyệt đối ở góc trên bên phải của vùng nội dung chính. Khoảng cách với mép trên và mép phải là **18px**, không đặt sát góc.

Kích thước được điều chỉnh responsive bằng CSS `clamp()`:

| Thiết lập | Giá trị | Ý nghĩa |
|---|---:|---|
| Khoảng cách phía trên | `18px` | Cách mép trên của `.main-view` |
| Khoảng cách bên phải | `18px` | Cách mép phải của `.main-view` |
| Kích thước nhỏ nhất | `95px` | Dùng trên màn hình nhỏ |
| Kích thước theo viewport | `13.75vw` | Tự co giãn theo chiều rộng màn hình |
| Kích thước lớn nhất | `150px` | Không để logo quá lớn trên màn hình rộng |
| Chiều cao tối đa | `150px` | Giữ logo gọn trong vùng góc |
| Độ trong suốt | `0.94` | Hòa vào ảnh nền nhưng vẫn dễ nhận biết |

## CSS có thể tái sử dụng

```css
.main-view {
  position: relative;
}

.site-logo {
  position: absolute;
  top: 18px;
  right: 18px;
  width: clamp(95px, 13.75vw, 150px);
  height: auto;
  max-height: 150px;
  object-fit: contain;
  filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.28));
  opacity: 0.94;
  pointer-events: none;
  z-index: 11;
}
```

## HTML tương ứng

```html
<img
  class="site-logo"
  src="./thien-hao-dragon-logo-shadow.png"
  alt="Thiên Hào Real Estate Intelligence"
>
```

Nếu dùng logo trong một thư mục khác, chỉ cần đổi giá trị `src`; các thông số vị trí và kích thước có thể giữ nguyên.
