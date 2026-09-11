# Luna Calendar

Ứng dụng lịch âm dương đa nền tảng: xem âm lịch/dương lịch song song, đồng bộ
với Google Calendar và Lark (Feishu) Calendar, quản lý bạn bè/liên hệ, và tạo
sự kiện lặp lại theo **âm lịch** (ví dụ: giỗ, Tết, rằm hàng tháng) hoặc theo
**dương lịch** như bình thường.

## Kiến trúc (monorepo, pnpm workspaces)

```
luna-calendar/
├── packages/
│   ├── lunar-calendar/   @luna/lunar-calendar   — chuyển đổi âm↔dương lịch, mở rộng lịch lặp âm lịch (thuần TS, không phụ thuộc Node/RN)
│   └── shared-types/     @luna/shared-types     — kiểu dữ liệu dùng chung: Event, RecurrenceRule, CalendarAccount, Contact, User...
├── apps/
│   ├── api/               @luna/api    — backend Node.js/Express: OAuth Google & Lark, đồng bộ sự kiện 2 chiều, mở rộng lịch lặp âm lịch thành các sự kiện cụ thể để đẩy lên Google/Lark
│   └── mobile/             luna-mobile  — Expo (React Native + Web): 1 codebase chạy iOS, Android, và trình duyệt desktop
```

Vì Google Calendar/Lark Calendar không hỗ trợ "lặp lại theo âm lịch" một
cách tự nhiên, chiến lược đồng bộ là: `@luna/lunar-calendar` tính toán trước
các ngày dương lịch cụ thể của một quy tắc lặp âm lịch (ví dụ "hàng năm vào
mùng 1 Tết") cho một cửa sổ thời gian (vd. 2 năm tới), rồi backend đẩy từng
lần lặp đó lên Google/Lark như một sự kiện dương lịch bình thường (có gắn
metadata để nhận diện khi đồng bộ lại, tránh trùng lặp). Nhờ vậy việc đồng
bộ nhiều thiết bị (PC/laptop/mobile) tận dụng chính hạ tầng đồng bộ của
Google/Lark, cộng với một CSDL cục bộ ở backend để lưu cache/bạn bè/trạng thái.

## Bắt đầu

```bash
pnpm install
pnpm --filter @luna/lunar-calendar build
pnpm --filter @luna/shared-types build

# Backend
cp apps/api/.env.example apps/api/.env   # điền GOOGLE_*/LARK_*/JWT_SECRET nếu có
pnpm --filter @luna/api db:migrate
pnpm --filter @luna/api dev              # http://localhost:4000

# Mobile/desktop app (Expo)
pnpm --filter luna-mobile start          # nhấn i / a / w để chạy iOS / Android / Web
```

Xem `apps/api/README.md` và `apps/mobile/README.md` để biết chi tiết cấu
hình từng phần (lấy Google OAuth client, tạo Lark app, chạy trên máy thật...).

## Trạng thái & giới hạn hiện tại

Đây là bộ khung (scaffold) chức năng đầy đủ về mặt kiến trúc và đã được kiểm
thử ở phần lõi (thuật toán âm lịch), nhưng để trở thành sản phẩm hoàn chỉnh
cần thêm:

- **Thông tin xác thực OAuth thật**: cần tự tạo Google Cloud OAuth client và
  Lark/Feishu app (cả hai đều miễn phí) rồi điền vào `apps/api/.env` — môi
  trường sandbox này không có sẵn thông tin xác thực thật của bạn.
- **Build ứng dụng thật cho iOS/Android** (App Store/Play Store) cần tài
  khoản nhà phát triển Apple/Google và chạy `eas build` — nằm ngoài phạm vi
  của phiên làm việc này, nhưng `apps/mobile` đã sẵn sàng để build qua EAS.
- Đăng nhập tạm thời qua `dev-login` (không cần Google/Lark thật) để bạn có
  thể chạy thử toàn bộ luồng ứng dụng ngay lập tức.

## Tính năng lõi đã có

- Chuyển đổi chính xác âm lịch ↔ dương lịch (thuật toán thiên văn chuẩn,
  đã kiểm thử với các mốc Tết 2023-2026 và ranh giới tháng nhuận).
- Mở rộng quy tắc lặp âm lịch (hàng năm/hàng tháng, có xử lý tháng nhuận)
  thành danh sách ngày dương lịch cụ thể.
- Kết nối OAuth Google Calendar (+ Google Contacts) và Lark Calendar
  (+ Lark Contacts) phía backend.
- Đồng bộ 2 chiều: kéo sự kiện từ provider về, đẩy sự kiện (kể cả các lần
  lặp âm lịch đã mở rộng) lên provider.
- Ứng dụng Expo hiển thị lịch tháng có cả số ngày âm và dương, tạo sự kiện
  với lựa chọn lặp theo âm/dương lịch kèm xem trước các lần lặp tiếp theo,
  danh sách bạn bè/liên hệ, quản lý tài khoản đã kết nối.
