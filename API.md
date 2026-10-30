# Tài liệu API

Free AI Gateway cung cấp một API HTTP tương thích OpenAI cho các nhà cung cấp AI web.
Tất cả các yêu cầu gửi tới cổng trên này sẽ được định tuyến đến nhà cung cấp đã cấu hình
thông qua phiên trình duyệt Chrome.

## Điểm cuối (Endpoint)

| Phương thức | Đường dẫn              | Mô tả                                           |
|-------------|------------------------|-------------------------------------------------|
| `GET`       | `/v1/models`           | Liệt kê mô hình khả dụng                        |
| `POST`      | `/v1/chat/completions` | Tạo hoặc tiếp tục một cuộc trò chuyện (sync & streaming) |

## Xác thực (Authentication)

Nếu biến môi trường `FAG_API_KEY` (hoặc trường `apiKey` trong file cấu hình) được thiết lập,
mọi yêu cầu đều cần gửi kèm header xác thực Bearer:

```
Authorization: Bearer <FAG_API_KEY>
```

Nếu không có API key được cấu hình, tất cả yêu cầu đều được chấp nhận mà không cần xác thực.

## POST /v1/chat/completions

### Tham số yêu cầu (Body)

Tuân thủ tiêu chuẩn OpenAI API.

| Tham số           | Kiểu             | Bắt buộc | Mô tả                                                      |
|-------------------|------------------|----------|------------------------------------------------------------|
| `model`           | `string`         | Có       | Mã nhà cung cấp + tên mô hình (ví dụ: `chatgpt-web` hoặc `claude-web`) |
| `messages`        | `array`          | Có       | Danh sách tin nhắn theo chuẩn OpenAI                        |
| `stream`          | `boolean`        | Không    | Nếu `true`, trả về dữ liệu dạng SSE (streaming)            |
| `temperature`     | `number`         | Không    | Độ sáng tạo (0–2)                                          |
| `max_tokens`      | `integer`        | Không    | Số token tối đa trong phản hồi                              |
| `tools`           | `array`          | Không    | Định nghĩa các công cụ gọi từ phía client                   |
| `tool_choice`     | `string\|object`  | Không    | Điều khiển chọn công cụ                                     |
| `user`            | `string`         | Không    | ID người dùng để theo dõi                                    |

### Định dạng model

`model` có thể dưới hai dạng:

1. **Mã nhà cung cấp**: `chatgpt-web`, `claude-web`, `deepseek-web`, `gemini-web`, v.v.
   Lhiêu nghĩa là sử dụng nhà cung cấp và mô hình mặc định của nó.
2. **Mã nhà cung cấp + tên mô hình**: `claude-web:claude-3-7-sonnet-20250219`
   Chỉ định mô hình cụ thể cho nhà cung cấp.

### Phản hồi không streaming

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "claude-web",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "..." },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30 }
}
```

### Phản hồi streaming (SSE)

Khi `stream: true`, máy chủ trả về một luồng SSE với các dòng `data: ` theo định dạng
OpenAI. Mỗi phần là một JSON hợp lệ. Luồng kết thúc bằng `data: [DONE]`.

### Mã lỗi (Error responses)

Tuân thủ định dạng lỗi OpenAI:

```json
{
  "error": {
    "message": "Mô tả lỗi bằng tiếng Việt",
    "type": "invalid_request_error",
    "param": null,
    "code": 400
  }
}
```

| Mã trạng thái | `type`                  | Nguyên nhân                                           |
|---------------|-------------------------|-------------------------------------------------------|
| 400           | `invalid_request_error` | Yêu cầu thiếu tham số bắt buộc                        |
| 401           | `authentication_error`  | API key không hợp lệ                                    |
| 403           | `permission_error`      | Phiên làm việc đã hết hạn — chạy `webauth` để làm mới  |
| 502/503       | `provider_error`        | Lỗi từ nhà cung cấp AI (timeout, server lỗi, v.v.)    |

## GET /v1/models

Trả về danh sách mô hình hỗ trợ. Đây là endpoint tĩnh, liệt kê tất cả nhà cung cấp
và mô hình mặc định của chúng.
