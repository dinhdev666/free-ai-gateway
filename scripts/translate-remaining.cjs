// Comprehensive translation script for remaining English strings in provider files
const fs = require('fs');
const path = require('path');

const replacements = [
  // Error messages in auth.ts
  ['Failed to connect to Chrome at ', 'Không thể kết nối tới Chrome tại '],
  ['. Make sure Chrome is running in debug mode.', '. Đảm bảo Chrome đang chạy ở chế độ debug.'],
  ['(e.g. ./start-chrome-debug.sh)', '(ví dụ: ./start-chrome-debug.sh)'],
  ['No browser context available', 'Không có browser context khả dụng'],
  ['Login timed out (5 minutes).', 'Đăng nhập đã hết thời gian (5 phút).'],
  ['Browser window closed before login was captured.', 'Cửa sổ trình duyệt đã đóng trước khi đăng nhập được thu thập.'],
  ['Failed to resolve Chrome WebSocket URL from ', 'Không thể phân giải URL WebSocket của Chrome từ '],
  [' after retries.', ' sau các lần thử.'],

  // onProgress strings
  ['Waiting for session cookies...', 'Đang chờ cookies session...'],
  ['Please login to DeepSeek in the opened browser window. The session token will be captured automatically once you are logged in.',
   'Vui lòng đăng nhập DeepSeek trong cửa sổ trình duyệt đã mở. Token session sẽ được thu thập tự động khi bạn đã đăng nhập.'],

  // Comments in source
  ['// ignore navigation errors', '// Bỏ qua lỗi điều hướng'],
  ['// ignore localStorage errors', '// Bỏ qua lỗi localStorage'],
  ['// ignore API errors', '// Bỏ qua lỗi API'],
  ['// ignore cookie errors', '// Bỏ qua lỗi cookie'],

  // Console error messages in client.ts
  ['Grok uses custom sendMessage; callApi is not reachable.', 'Grok sử dụng sendMessage tùy chỉnh; callApi không thể truy cập.'],
  ['Grok API error:', 'Lỗi API Grok:'],
  ['Grok: could not find chat input', 'Grok: không tìm thấy thanh nhập chat'],
  ['Grok request aborted', 'Yêu cầu Grok bị hủy'],
  ['No response body', 'Không có phần thân phản hồi'],
  ['GLM Intl UI send failed: no chat input found.', 'Gửi GLM Intl thất bại: không tìm thấy thanh nhập chat.'],
  ['XiaomiMimo chat completion failed:', 'XiaomiMimo chat completion thất bại:'],

  // JSDoc comments in client.ts
  ['Custom sendMessage for ChatGPT: uses fetch to OpenAI API', 'Custom sendMessage cho ChatGPT: sử dụng fetch tới API OpenAI'],
  ['Override sendMessage for custom error handling:', 'Ghi đè sendMessage để xử lý lỗi tùy chỉnh:'],
  ['Custom page bootstrapping: wait for oaistatic scripts.', 'Khởi tạo trang tùy chỉnh: chờ script oaistatic.'],
  ['Not used directly — Grok overrides `sendMessage` because its', 'Không dùng trực tiếp — Grok ghi đè `sendMessage` vì'],
  ['pull-based streaming and DOM fallback logic requires custom flow.', 'logic streaming dựa trên pull và DOM fallback yêu cầu flow tùy chỉnh.'],
  ['Full custom sendMessage:', 'Custom sendMessage đầy đủ:'],
  ['Uses page.evaluate to call Grok API with conversation management', 'Sử dụng page.evaluate để gọi API Grok với quản lý conversation'],
  ['Returns pull-based ReadableStream from NDJSON chunks', 'Trả về ReadableStream dựa trên pull từ các chunk NDJSON'],
  ['Not used directly — DeepSeek overrides `sendMessage` because', 'Không dùng trực tiếp — DeepSeek ghi đè `sendMessage` vì'],
  ['its flow (PoW + streaming) cannot be expressed as a simple EvalResult.', 'flow của nó (PoW + streaming) không thể biểu đạt qua EvalResult đơn giản.'],
  ['Custom page bootstrapping with structured cookie objects.', 'Khởi tạo trang tùy chỉnh với đối tượng cookie có cấu trúc.'],
  ['401 → SessionExpiredError', '401 → SessionExpiredError'],
  ['403/anti-bot → DOM fallback', '403/anti-bot → DOM fallback'],
  ['403 (rate limit) → clear error', '403 (giới hạn tốc độ) → lỗi rõ ràng'],
  ['403 (other) → DOM fallback', '403 (khác) → DOM fallback'],
  ['Custom sendMessage to handle Claude-specific error flows:', 'Custom sendMessage để xử lý luồng lỗi đặc thù Claude:'],
  ['Claude Web client (CDP-based).', 'Client Claude Web (dựa trên CDP).'],
  ['Sends messages to claude.ai API using Chrome browser context to bypass', 'Gửi tin nhắn tới API claude.ai sử dụng ngữ cảnh trình duyệt Chrome để vượt qua'],
  ['Cloudflare bot protection, similar to ChatGPT and Kimi clients.', 'bảo vệ bot Cloudflare, tương tự client ChatGPT và Kimi.'],
  ['Claude Web SSE stream parser.', 'Parser SSE của Claude Web.'],
  ['Handles multiple Claude response formats including thinking blocks.', 'Xử lý nhiều định dạng phản hồi của Claude bao gồm cả khối suy nghĩ.'],
  ['Claude Web authentication via Chrome CDP.', 'Xác thực Claude Web qua Chrome CDP.'],
  ['Captures sessionKey cookie from claude.ai after user logs in.', 'Bắt cookie sessionKey từ claude.ai sau khi người dùng đăng nhập.'],

  // JSDoc in types.ts
  ['Carries a provider-side HTTP status code so the gateway can return', 'Chứa mã trạng thái HTTP phía nhà cung cấp để gateway trả về'],
  ['an appropriate HTTP status to the client (e.g. 400 → don\'t retry).', 'mã trạng thái HTTP phù hợp cho client (ví dụ: 400 → không retry).'],

  // JSDoc in chatgpt/client.ts
  ['Custom sendMessage for ChatGPT: uses fetch to OpenAI API with conversation', 'Custom sendMessage cho ChatGPT: sử dụng fetch tới API OpenAI với conversation'],
  ['management and DOM fallback.', 'quản lý và DOM fallback.'],
];

const providersDir = path.join(__dirname, '..', 'src', 'providers');
const providerDirs = fs.readdirSync(providersDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== 'shared' && d.name !== 'factory');

// Also include the main src files
const rootFiles = [
  path.join(__dirname, '..', 'src', 'openai', 'chat-completions.ts'),
  path.join(__dirname, '..', 'src', 'openai', 'types.ts'),
  path.join(__dirname, '..', 'src', 'openai', 'sse.ts'),
];

let totalUpdated = 0;

function processFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return false;
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated: ' + filePath);
    totalUpdated++;
    return true;
  }
  return false;
}

// Process provider files
for (const dir of providerDirs) {
  const dirPath = path.join(providersDir, dir.name);
  const files = ['auth.ts', 'client.ts', 'stream.ts', 'index.ts'];
  for (const fname of files) {
    processFile(path.join(dirPath, fname), replacements);
  }
}

// Also process shared/factory files and root src files
const sharedFiles = [
  path.join(providersDir, 'shared', 'cookie-parser.ts'),
  path.join(providersDir, 'shared', 'stream-helpers.ts'),
  path.join(providersDir, 'shared', 'eval-helpers.ts'),
  path.join(providersDir, 'shared', 'page-lifecycle.ts'),
  path.join(providersDir, 'shared', 'error-guard.ts'),
  path.join(providersDir, 'types.ts'),
  path.join(providersDir, 'registry.ts'),
  path.join(providersDir, 'auth-store.ts'),
];

for (const f of sharedFiles) {
  processFile(f, replacements);
}

for (const f of rootFiles) {
  processFile(f, replacements);
}

console.log('\n' + totalUpdated + ' files updated.');
