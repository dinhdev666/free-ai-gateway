# Nhật quý thay đổi (Changelog)

Tất cả các thay đổi đáng chú ý của dự án **Free AI Gateway** đều được ghi nhận
trong tệp này. Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/),
và dự án tuân thủ [Semantic Versioning](https://semver.org/).

## [0.5.2] — 2025-01-01

### Đã thay đổi
- Đổi tên dự án từ **Token-Free Gateway** sang **Free AI Gateway** (FAG).
- Chuyển đổi toàn bộ dự án từ **Bun** sang **pnpm** + **Node.js**.
  - `bun` / `bunx` → `pnpm` / `pnpm exec`
  - `bun:test` → `vitest`
  - Thêm `@types/node`, `tsx`, `vitest`, `esbuild`, `pkg` vào devDependencies.
  - Xóa `@types/bun` khỏi devDependencies.
  - `bun build --compile` → `tsc && esbuild && pkg`.
  - Xóa `scripts/postinstall.ts` (Bun-specific WebSocket patch).
- Đổi cổng mặc định từ `3456` sang `20123`.
- Đổi tiền tố biến môi trường từ `TFG_` sang `FAG_`.
- Đổi thư mục dữ liệu từ `~/.token-free-gateway/` sang `~/.free-ai-gateway/`.
- Đổi tên thư mục profile Chrome debug:
  - `chrome-tfg-debug` → `chrome-fag-debug`
  - `Chrome-TFG-Debug` → `Chrome-FAG-Debug`
- Đổi URL kho lưu trữ GitHub từ `https://` sang định dạng SSH:
  `git@github.com:dinhdev666/free-ai-gateway.git`.
- Đổi tên người dùng GitHub từ `andeya` sang `dinhdev666`.
- Cập nhật `.gitignore`: thay `bun.lock` bằng `pnpm-lock.yaml`.
- Tạo `vitest.config.ts` cho bộ kiểm thử Vitest.
- Dịch toàn bộ giác phản hồi, comment code, và tài liệu sang tiếng Việt.

### Đã thêm
- `AGENTS.md` — Hướng dẫn cho AI agents.
- `API.md` — Tài liệu API HTTP.
- `ARCHITECTURE.md` — Kiến trúc hệ thống.
- `CONTRIBUTING.md` — Hướng dẫn đóng góp.
- `SECURITY.md` — Chính sách bảo mật.
- `LICENSE` — Giấy phép MIT với tác giả **Phạm Văn Đinh**.

### Đã xóa
- `README_zh-CN.md` — Tệp tin README tiếng Trung (không còn hỗ trợ đa ngôn ngữ).
- `CLAUDE.md` — Tệp tin hướng dẫn cho Claude (thay thế bởi `AGENTS.md`).
- `scripts/translate-providers.ps1` — Script dịch bulk (đã hoàn thành nhiệm vụ).
- `scripts/translate-providers.cjs` — Script dịch bulk (đã hoàn thành nhiệm vụ).

### Đã sửa
- Sửa lỗi `require is not defined` trong script dịch (Node.js ESM).
- Sửa lỗi `pnpm exec tsx` do `ERR_PNPM_IGNORED_BUILDS`.
- Sửa lỗi PowerShell bulk-replace do dấu backslash Windows.
- Sửa lỗi staleness khi ghi file test sau khi bulk-replace.
- Sửa lỗi `edit` JSDoc do chênh lệch tab vs space.
- Sửa lỗi `webauth.ts` do dùng tham số `path` thay vì `file_path`.

### Nhà cung cấp (13)
| Nhà cung cấp   | Mã provider      | Phương thức |
|----------------|------------------|-------------|
| Claude         | `claude-web`     | CDP/DOM     |
| ChatGPT        | `chatgpt-web`    | CDP/API     |
| DeepSeek       | `deepseek-web`   | CDP/PoW     |
| Doubao         | `doubao-web`     | CDP         |
| Gemini         | `gemini-web`     | CDP         |
| GLM            | `glm-web`        | CDP         |
| GLM-Intl       | `glm-intl-web`   | CDP/DOM     |
| Grok           | `grok-web`       | CDP         |
| Kimi           | `kimi-web`       | CDP         |
| Perplexity     | `perplexity-web` | CDP/DOM     |
| Qwen           | `qwen-web`       | CDP         |
| Qwen-CN        | `qwen-cn-web`    | CDP         |
| XiaomiMimo     | `mimo-web`       | CDP         |

## Lịch sử trước đây

### [0.5.1] — Phiên bản trước khi đổi tên
- Các công việc ban đầu dưới tên **Token-Free Gateway** (TFG).
