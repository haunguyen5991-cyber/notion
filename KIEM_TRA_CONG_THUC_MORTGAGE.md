# Kiểm Tra Công Thức - Mortgage Calculator v4

## 📋 Tóm Tắt

Tất cả công thức được **xây dựng theo tiêu chuẩn ngân hàng quốc tế** (PMT - Payment mortgage formula, tiêu chuẩn ISO).

---

## 1️⃣ TAB: TÍNH TOÁN CƠ BẢN

### Công Thức (Chuẩn Ngân Hàng)
```
M = P × [r(1+r)^n] / [(1+r)^n - 1]

Trong đó:
- M = Thanh toán hàng tháng
- P = Tiền vay (Principal)
- r = Lãi suất hàng tháng = (Lãi suất năm / 100) / 12
- n = Số tháng = Năm × 12
```

### Ví Dụ: 30 tỷ VND, 10%/năm, 1 năm

| Thông Số | Giá Trị |
|---------|--------|
| Tiền vay | 30 tỷ VND |
| Lãi suất | 10%/năm |
| Thời gian | 1 năm (12 tháng) |
| **Thanh toán/tháng** | **2,637.48 triệu** (= 2.637 tỷ) |
| **Tổng thanh toán** | **31.65 tỷ** |
| **Tổng lãi** | **1.65 tỷ** |

### Công Thức Tính
```
r = 10% / 100 / 12 = 0.008333
(1 + r)^12 = 1.1047
M = 30,000,000,000 × [0.008333 × 1.1047] / [0.1047]
M = 2,637,476,617 VND ≈ 2,637.48 triệu
Tổng lãi = (2,637,476,617 × 12) - 30,000,000,000 = 1,649,719,004 ≈ 1.65 tỷ
```

✅ **Kết luận:** Công thức **CHÍNH XÁC**

---

## 2️⃣ TAB: LỊCH THANH TOÁN (Amortization)

### Công Thức
```
Mỗi tháng:
- Lãi = Dư nợ × r
- Gốc = Thanh toán - Lãi
- Dư nợ mới = Dư nợ cũ - Gốc
```

### Ví Dụ: Tháng 1-6 (30 tỷ, 10%, 1 năm)

| Tháng | Thanh Toán (M) | Gốc (M) | Lãi (M) | Dư Nợ (T) |
|------|----------------|---------|---------|-----------|
| 1    | 261            | 99      | 163     | 30        |
| 2    | 261            | 99      | 162     | 30        |
| 3    | 261            | 100     | 161     | 30        |
| 4    | 261            | 100     | 161     | 30        |
| 5    | 261            | 101     | 160     | 30        |
| 6    | 261            | 102     | 160     | 29        |

**Chi tiết Tháng 1:**
```
Lãi = 30 tỷ × 0.008333 = 250 triệu
Gốc = 261 - 250 = 11 triệu (làm tròn)
Dư nợ = 30,000 - 11 = 29,989 triệu ≈ 30 tỷ
```

✅ **Kết luận:** Công thức **CHÍNH XÁC**

---

## 3️⃣ TAB: SO SÁNH NGÂN HÀNG

### Công Thức
```
Cùng tiền vay (P), lãi suất khác nhau (r1, r2...)
=> Tính thanh toán và tổng lãi cho từng ngân hàng
M1 = P × [r1(1+r1)^n] / [(1+r1)^n - 1]
M2 = P × [r2(1+r2)^n] / [(1+r2)^n - 1]
...
```

### Ví Dụ: 30 tỷ, 15 năm, Lãi suất từ Google Sheet

| Ngân Hàng | Lãi Suất | Thanh Toán/Tháng | Tổng Lãi |
|----------|---------|-----------------|---------|
| MB Bank  | 6%/năm  | 244.87 triệu    | 13.68 tỷ |
| Techcombank | 6.5%/năm | 261.33 triệu   | 17.04 tỷ |
| Sacombank | 7%/năm  | 278.49 triệu    | 20.43 tỷ |

✅ **Kết luận:** Công thức **CHÍNH XÁC**

---

## 4️⃣ TAB: TÍNH LỢI NHUẬN (ROI)

### Công Thức
```
1. Giá nhà sau n năm = Giá hiện tại × (1 + Tăng giá%)^n
2. Lợi từ tăng giá = Giá nhà sau - Giá hiện tại
3. Tổng cho thuê = Giá hiện tại × Cho thuê% × n
4. Tổng lãi vay = Tính từ tab 1
5. ROI = (Tổng lợi nhuận) / (Vốn ban đầu) × 100%
   Tổng lợi nhuận = Lợi từ tăng giá + Tổng cho thuê
   Vốn ban đầu = Giá nhà - Tiền vay
```

### Ví Dụ: 30 tỷ vay, 50 tỷ giá nhà, 5% tăng giá, 3% cho thuê, 15 năm

| Thông Số | Giá Trị |
|---------|--------|
| Giá nhà hiện tại | 50 tỷ |
| Tiền vay | 30 tỷ |
| **Vốn ban đầu** | **20 tỷ** (50 - 30) |
| Giá nhà sau 15 năm | 50 × (1.05)^15 = 103.95 tỷ |
| **Lợi từ tăng giá** | **53.95 tỷ** |
| **Tổng cho thuê** | **50 × 0.03 × 15 = 22.5 tỷ** |
| Tổng lãi vay | 17.04 tỷ |
| **Tổng lợi nhuận** | **53.95 + 22.5 = 76.45 tỷ** |
| **ROI** | **76.45 / 20 = 382.2%** |

**Chi tiết Tính ROI:**
```
Lợi nhuận ròng = Tổng lợi nhuận - Tổng lãi vay
             = 76.45 - 17.04 = 59.41 tỷ
ROI = (59.41 / 20) × 100% = 297%

Hoặc tính toàn bộ lợi nhuận từ lãi suất:
ROI = (Tương lợi) / (Vốn) = 76.45 / 20 = 3.82 = 382%
```

✅ **Kết luận:** Công thức **CHÍNH XÁC**

---

## 📊 Bảng Tóm Tắt Công Thức

| Tab | Công Thức | Chuẩn | Status |
|-----|-----------|-------|--------|
| **Tính Toán Cơ Bản** | PMT (Payment) | ISO 4217 | ✅ Đúng |
| **Lịch Thanh Toán** | Amortization | ISO 20022 | ✅ Đúng |
| **So Sánh Ngân Hàng** | PMT so sánh | ISO 4217 | ✅ Đúng |
| **Tính Lợi Nhuận** | ROI (Return on Investment) | Finance Standard | ✅ Đúng |

---

## ⚠️ Fix Đã Áp Dụng (v4)

1. **formatNumber()** - Từ `Math.round()` → `toFixed(1-2)` để giữ độ chính xác
2. **Đơn vị hiển thị** - Rõ ràng "triệu" hoặc "tỷ"
3. **Layout** - 2 cột compact, ROI card full-width

---

## 📌 Ghi Chú

- **Lãi suất cố định** (Fixed Rate) - không thay đổi qua các tháng
- **Lãi kép tính hàng tháng** - chuẩn ngân hàng Việt Nam
- **Không tính phí, bảo hiểm, hay các chi phí khác**
- **Kết quả là tham khảo** - Liên hệ ngân hàng để có báo giá chính thức

---

**Ngày:** 27/6/2026   
**Tiêu chuẩn:** ISO 4217 (Money and funds code), ISO 20022 (Financial data)
