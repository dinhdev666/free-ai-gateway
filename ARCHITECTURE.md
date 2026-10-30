# Kiến trúc (Architecture)

## Tổng quan

Free AI Gateway là một **cổng trung gian (gateway)** HTTP tương thích OpenAI,
cho phép truy cập các dịch vụ AI thông qua **phiên trình duyệt Chrome thực**.
Thay vì dựa vào API key chính thức (thường có phí hoặc giới hạn), dự án khởi
động Chrome ở chế độ **remote-debug**, mở trang web của nhà cung cấp, dùng
thông tin đăng nhập đã lưu để gửi yêu cầu và thu thập phản hồi.

```text
┌───────────┐     ┌──────────────────┐     ┌──────────────────────┐
│ OpenAI    │────▶│ Free AI Gateway  │────▶│ Chrome (CDP)         │
│ Compatible│  HTTP │ src/server.ts    │   CDP │ src/browser/       │
│ Client    │────▶│                  │────▶│                      │
│ (curl,     │  OpenAI  │                  │   │ ┌── chatgpt.com    │
│  SDK, etc)│   API    │                  │   │ ├── claude.ai      │
└───────────┘     └──────────────────┘   │ ├── deepseek.com     │
                                          │ ├── gemini.google.com│
                                          │ └── ... (13 providers)│
                                          └──────────────────────┘
```

## Các thành phần chính

### 1. Máy chủ HTTP (`src/server.ts`)

- Sử dụng `http.createServer` của Node.js (không dùng Bun).
- Chuyển đổi `IncomingMessage` của Node.js sang `Request` Web thông qua
  `Readable.toWeb()` (Node.js 20+).
- Định tuyến các yêu cầu tới `/v1/models` và `/v1/chat/completions`.
- Xác thực Bearer token qua `src/auth.ts` (tuỳ chọn thông qua `FAG_API_KEY`).
- Chuyển tiếp lỗi nhà cung cấp sang mã trạng thái HTTP phù hợp.

### 2. Lớp API OpenAI (`src/openai/`)

- `chat-completions.ts`: Xử lý logic streaming, timeout, và định dạng phản hồi
  theo chuẩn OpenAI (JSON hoặc SSE).
- `types.ts`: Các kiểu dữ liệu yêu cầu/phản hồi theo chuẩn OpenAI API.

### 3. Nhà cung cấp AI (`src/providers/`)

Mỗi nhà cung cấp có cấu trúc sau:

```text
providers/
├── registry.ts       # Đăng ký danh sách nhà cung cấp (13 providers)
├── types.ts          # ProviderProvider, ProviderClient, EvalResult...
├── auth-store.ts     # Lưu trữ và quản lý credentials
├── factory/
│   ├── base-api-client.ts   # Lớp cơ sở dùng fetch API
│   ├── base-dom-client.ts   # Lớp cơ sở dùng CDP/DOM
│   ├── types.ts             # TypeScript interfaces chung
│   └── index.ts             # Hàm khởi tạo provider
├── shared/
│   ├── cookie-parser.ts     # Parse cookies từ CDP context
│   ├── stream-helpers.ts    # Xây dựng SSE stream
│   ├── eval-helpers.ts      # withEvalTimeout, injectScript
│   ├── page-lifecycle.ts    # pollForStableText, lifecycle DOM
│   ├── error-guard.ts       # Bảo vệ lỗi chung
│   └── dom-input.ts         # Dán text vào input
├── [provider]/
│   ├── auth.ts      # Lấy credentials qua Chrome CDP
│   ├── client.ts    # Gửi tin nhắn + thu thập phản hồi
│   ├── stream.ts    # Chuyển đổi phản hồi thành ReadableStream
│   └── index.ts     # Export và đăng ký provider
```

**13 nhà cung cấp**: Claude, ChatGPT, DeepSeek, Doubao, Gemini, GLM, GLM-Intl,
Grok, Kimi, Perplexity, Qwen, Qwen-CN, XiaomiMimo.

### 4. Quản lý trình duyệt (`src/browser/`)

- `manager.ts`: Singleton quản lý kết nối CDP tới Chrome.
  - Tự động kết nối lại khi Chrome khởi động lại.
  - Kiểm tra sức khỏe kết nối định kỳ.
  - Tự động khởi động Chrome nếu chưa chạy.
- `cdp-helpers.ts`: Các tiện ích thấp cấp cho CDP.
- `dom-input.ts`: Dán văn bản vào trường input thông qua ClipboardEvent.
- `page-lifecycle.ts`: Quản lý vòng đời trang (poll, cleanup, navigation).

### 5. Tool calling (`src/tool-calling/`)

- `converter.ts`: Chuyển đổi định dạng tool calling từ OpenAI sang Claude Web.
- `parser.ts`: Phân tích tool calls từ phản hồi văn bản của mô hình.
- `prompt.ts`: Prompt hướng dẫn mô hình cách gọi công cụ (giữ nguyên tiếng Anh).

### 6. CLI (`index.ts` + `src/cli/`)

| Lệnh                       | Mô tả                                                        |
|----------------------------|-------------------------------------------------------------|
| `serve` (mặc định)         | Khởi động máy chủ gateway ở nền trước                      |
| `start`                    | Khởi động gateway ở nền sau (daemon)                         |
| `stop`                     | Dừng gateway đang chạy                                     |
| `restart`                  | Khởi động lại gateway                                       |
| `status`                   | Hiển thị trạng thái daemon                                 |
| `webauth`                  | Trình thủ công phân quyền nhà cung cấp qua Chrome CDP       |
| `chrome [start|stop]`      | Khởi động/dừng Chrome ở chế độ remote-debug                |

## Cách hoạt động của một yêu cầu

1. Client gửi `POST /v1/chat/completions` với `model=claude-web`.
2. `server.ts` phân tích model → chọn nhà cung cấp "claude".
3. Lấy `ClaudeWebClient` từ factory.
4. `browser/manager.ts` cung cấp `BrowserContext` đã có cookies xác thực.
5. `client.ts` gửi tin nhắn qua CDP (`page.evaluate`).
6. `stream.ts` chuyển đổi phản hồi thành `ReadableStream<Uint8Array>`.
7. `chat-completions.ts` đóng gói thành định dạng OpenAI (JSON hoặc SSE).
8. `server.ts` gửi phản hồi về client.

## Cấu hình

| Nguồn                | Thứ tự ưu tiên | Mô tả                              |
|---------------------|----------------|-------------------------------------|
| Biến môi trường `FAG_*` | Cao nhất       | `FAG_PORT`, `FAG_API_KEY`, `FAG_CDP_URL`, `FAG_REQUEST_TIMEOUT_SEC` |
| File cấu hình        | Trung bình      | `~/.free-ai-gateway/config.json`   |
| Giá trị mặc định     | Thấp nhất       | Được hard-code trong `src/config.ts` |

## Cách dựng binary

```bash
pnpm build
```

Quy trình build:
1. `tsc` — biên dịch TypeScript (kiểm tra kiểu).
2. `esbuild` — bundle `index.ts` thành `dist/index.js` (CommonJS).
