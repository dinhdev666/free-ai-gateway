# Hướng dẫn đóng góp (Contributing)

Cảm ơn bạn đã quan tâm đến Free AI Gateway! Tài liệu này mô tả cách đóng góp.

## Bắt đầu

1. **Fork** kho lưu trữ từ `git@github.com:dinhdev666/free-ai-gateway.git`.
2. **Cài đặt dependencies**:
   ```bash
   pnpm install
   ```
3. **Tạo nhánh** (branch) cho tính năng của bạn:
   ```bash
   git checkout -b feat/tinh-nang-moi
   ```

## Quy tắc chung

- **Ngôn ngữ**: Toàn bộ code, comment, và tài liệu phải bằng **tiếng Việt**.
  - Ngoại lệ: Các giá trị chuẩn API (như `"stop"`, `"tool_calls"`, `"chat.completion"`)
    và các chuỗi prompt hướng dẫn mô hình AI được giữ nguyên tiếng Anh để đảm bảo
    tính tương thích.
  - Các tên miền, URL API, CSS selector, và chuỗi DOM được dùng để matching
    (như `"chatgpt.com"`, `"oaistatic.com"`, `"Gemini"`) **không** được dịch.
- **Công nghệ**: Dự án sử dụng **pnpm** + **Node.js**. Không sử dụng Bun.
  - Cài đặt: `pnpm install`
  - Chạy dev: `pnpm dev`
  - Chạy: `pnpm start`
  - Build: `pnpm build`
  - Test: `pnpm test`
  - Lint: `pnpm check` (tự động sửa lỗi) / `pnpm lint` (chỉ kiểm tra)
  - Định dạng: `pnpm format`

## Cấu trúc mã nguồn

Xem [ARCHITECTURE.md](./ARCHITECTURE.md) để biết chi tiết kiến trúc hệ thống.

## Thêm một nhà cung cấp AI mới

1. Tạo thư mục `src/providers/[ten-provider]/`.
2. Tạo 4 tệp:
   - `auth.ts` — Lấy credentials qua Chrome CDP.
   - `client.ts` — Gửi tin nhắn và thu thập phản hồi.
   - `stream.ts` — Chuyển đổi phản hồi thành `ReadableStream<Uint8Array>`.
   - `index.ts` — Export provider và đăng ký vào danh sách.
3. Đăng ký provider trong `src/providers/registry.ts`.
4. Thêm mô hình vào `src/openai/types.ts` (nếu có model-specific).
5. Thêm test nếu cần.

Mỗi tệp phải có JSDoc bằng tiếng Việt.

## Chạy kiểm thử

```bash
pnpm test              # Chạy toàn bộ test
pnpm test -- --watch   # Chạy ở chế độ watch
```

Đảm bảo tất cả test đều pass trước khi gửi pull request.

## Quy trình pull request

1. Đảm bảo code của bạn vượt qua `pnpm check` (lint + format).
2. Đảm bảo `pnpm typecheck` (TypeScript type check) không có lỗi.
3. Đảm bảo `pnpm test` pass.
4. Gửi pull request với mô tả rõ ràng về thay đổi.
5. Một thành viên review sẽ kiểm tra và duyệt.

## Báo cáo lỗi / lỗ hổng bảo mật

- Với lỗi thường: mở một issue trên GitHub.
- Với lỗ hổng bảo mật: liên hệ trực tiếp qua
  [SECURITY.md](./SECURITY.md).
