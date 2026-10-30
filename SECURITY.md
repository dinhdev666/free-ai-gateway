# Chính sách bảo mật (Security)

## Báo cáo lỗ hổng bảo mật

Chúng tôi coi trọng sự an toàn của dự án. Nếu bạn phát hiện một lỗ hổng bảo mật,
**xin đừng mở issue công khai**. Thay vào đó, vui lòng báo cáo ngay cho chúng tôi.

### Liên hệ

- **Email**: [dinhdev666@users.noreply.github.com](mailto:dinhdev666@users.noreply.github.com)
- Vui lòng bao gồm trong email:
  - Mô tả chi tiết lỗ hổng.
  - Các bước để tái hiện.
  - Tác động tiềm tạing.
  - (Tùy chọn) Đề xuất cách khắc phục.

Chúng tôi sẽ phản hồi trong vòng **72 giờ** và cố gắng phát hành bản vá trong vòng
**7 ngày** kể từ khi xác nhận lỗ hổng.

## Lỗ hổng đã biết

Hiện tại không có lỗ hổng bảo mật nào đang mở.

## Thực hành bảo mật tốt

1. **API key**: Luôn sử dụng biến môi trường `FAG_API_KEY` để bảo vệ cổng truy cập.
   Đặt giá trị mạnh và đổi định kỳ.
2. **Chrome debug port**: Chỉ kết nối CDP tới `127.0.0.1` (localhost),
   không bao giờ qua mạng công cộng.
3. **Credentials**: Cookies và tokens xác thực được lưu trữ cục bộ trên trình duyệt
   Chrome. Đảm bảo Chrome được bảo vệ bởi mật khẩu máy tính.
4. **Cập nhật**: Luôn cập nhật phiên bản mới nhất để nhận các bản vá bảo mật.
5. **Network**: Nếu triển khai trên môi trường server, sử dụng reverse proxy
   (nginx, Caddy) với HTTPS/TLS.

## Phạm vi

Các thành phần nằm trong phạm vi bảo mật bao gồm:
- `src/auth.ts` — Xác thực Bearer token.
- `src/config.ts` — Quản lý cấu hình (API key, cổng, CDP URL).
- `src/browser/manager.ts` — Kết nối CDP tới Chrome.
- Tất cả các tệp `*/auth.ts` trong `src/providers/` — Lấy và lưu trữ credentials.

## Chính sách bản quyền | Copyright

Dự án được cấp phép theo giấy phép **MIT**.
© 2025 Phạm Văn Đinh.
