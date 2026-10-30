# Hướng dẫn cho AI Agents

Chào mừng bạn đến với **Free AI Gateway** — cổng AI đa nhà cung cấp tương thích OpenAI,
được điều khiển bởi phiên web trình duyệt. Tài liệu này mô tả cách các AI agents và
nhà phát triển đóng góp vào dự án.

## Cấu trúc dự án

```text
free-ai-gateway/
├── index.ts                  # Điểm vào CLI chính
├── package.json              # Cấu hình dự án, script được quản lý bởi pnpm
├── tsconfig.json             # Cấu hình TypeScript
├── vitest.config.ts          # Cấu hình Vitest
├── biome.json               # Cấu hình Biome (lint + format)
├── src/
│   ├── server.ts             # Máy chủ HTTP API tương thích OpenAI
│   ├── auth.ts               # Xác thực Bearer token
│   ├── config.ts             # Tải cấu hình từ biến môi trường và file
│   ├── providers/            # Các nhà cung cấp AI (13 nhà cung cấp)
│   │   ├── registry.ts       # Danh sách và đăng ký nhà cung cấp
│   │   ├── types.ts          # Kiểu dữ liệu chung
│   │   ├── auth-store.ts     # Quản lý credentials xác thực
│   │   ├── factory/          # Lớp cơ sở cho client API & DOM
│   │   └── [provider]/       # Mỗi nhà cung cấp: auth.ts, client.ts, stream.ts, index.ts
│   ├── openai/               # Lớp API OpenAI tương thích
│   │   ├── chat-completions.ts
│   ├── browser/              # Quản lý Chrome CDP
│   │   ├── manager.ts
│   │   ├── cdp-helpers.ts
│   │   ├── dom-input.ts
│   │   └── page-lifecycle.ts
│   ├── tool-calling/         # Chuyển đổi tool calling giữa các định dạng
│   │   ├── converter.ts
│   │   ├── parser.ts
│   │   └── prompt.ts
│   └── cli/
│       ├── daemon.ts         # Quản lý tiến trình nền
│       ├── chrome.ts         # Khởi động/dừng Chrome debug
│       └── webauth.ts        # Trình thủ công xác thực web
├── test/                     # Các bài kiểm thử (Vitest)
├── scripts/                  # Script tiện ích
└── .github/workflows/        # CI/CD
```

## Cách chạy

### Cài đặt

```bash
pnpm install
```

### Phát triển

```bash
pnpm dev      # Chạy ở chế độ watch (tsx)
pnpm start    # Chạy trực tiếp (tsx)
```

### Kiểm thử

```bash
pnpm test
```

### Lint & định dạng

```bash
pnpm check    # Lint + tự động sửa
pnpm lint     # Chỉ lint
pnpm format   # Định dạng code
```

### Build

```bash
pnpm build    # Biên dịch TypeScript → esbuild bundle
```

## Quy tắc chung

1. **Ngôn ngữ**: Toàn bộ mã nguồn, comment, và tài liệu đều bằng tiếng Việt.
2. **Công nghệ**: Sử dụng pnpm + Node.js, không dùng Bun.
3. **TypeScript**: ESM (`"type": "module"`), `"moduleResolution": "bundler"`, `"verbatimModuleSyntax": true`.
4. **Tiền tố biến môi trường**: `FAG_` (Free AI Gateway).
5. **Cổng mặc định**: `20123`.
6. **Thư mục dữ liệu**: `~/.free-ai-gateway/`.
7. **Thay thế chuỗi**: API-standard values (như `"stop"`, `"tool_calls"`, `"chat.completion"`) phải giữ nguyên tiếng Anh để tương thích với OpenAI API.
8. **Chuỗi prompt AI**: Các chuỗi prompt hướng tới mô hình AI giữ nguyên tiếng Anh để đảm bảo tính nhất quán.
