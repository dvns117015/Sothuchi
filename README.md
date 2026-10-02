# Sổ Thu Chi 6 Lọ

Webapp quản lý thu nhập / chi tiêu theo **quy tắc 6 chiếc lọ** (NEC 55% · FFA 10% · EDU 10% · LTSS 10% · PLAY 10% · GIVE 5%).
Không cần server, không cần build — chỉ là HTML/CSS/JS thuần, chạy offline, cài được ra màn hình chính điện thoại (PWA).

## Chạy thử

```bash
python3 -m http.server 8000   # rồi mở http://localhost:8000
```

Hoặc bật **GitHub Pages** (Settings → Pages → Deploy from branch) để dùng trên điện thoại,
sau đó chọn *Chia sẻ → Thêm vào màn hình chính*.

## Thiết kế để "không lười cập nhật"

- **Ghi trong 3 chạm**: nút ＋ to ở giữa → bàn phím số có sẵn `000`, `+10k`, `+50k`… → Lưu.
- **Chạm vào lọ** trên trang chủ = mở form chi tiêu với lọ đó được chọn sẵn.
- **Ghi nhanh 1 chạm**: app tự học các khoản lặp lại (cà phê 35k, ăn trưa 50k…) và hiện thành nút; chạm là ghi luôn.
- **Ghi chú thông minh**: gõ/ chọn "Cà phê" → app tự chọn đúng lọ và điền số tiền lần trước.
- **Thu nhập tự chia 6 lọ** theo tỉ lệ (xem trước số tiền từng lọ), hoặc dồn vào 1 lọ.
- **Hoàn tác** ngay sau mỗi lần ghi/xoá — không sợ bấm nhầm.
- **Chuỗi ngày 🔥** và lời nhắc nhẹ khi hôm nay chưa ghi.
- Cảnh báo khi lọ âm, hoặc khi tiêu từ lọ nên để dành (FFA, LTSS).

## Trực quan

- 6 chiếc lọ có mực nước = phần còn lại so với số đã có trong tháng.
- Thống kê: ngân sách từng lọ (đã dùng / có), tỉ trọng chi theo lọ so với mục tiêu, biểu đồ thu–chi 6 tháng.
- Chế độ sáng / tối.

## Dữ liệu

Lưu trong `localStorage` của trình duyệt trên máy đó. Vào **Cài đặt → Sao lưu** để tải file `.json`
(khôi phục lại được), hoặc xuất **CSV** để mở bằng Excel/Google Sheets.

Phím tắt trên máy tính: `N` mở form, gõ số, `K` = `000`, `Enter` lưu, `Esc` đóng.
