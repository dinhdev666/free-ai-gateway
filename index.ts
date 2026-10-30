import pkg from "./package.json";
import { CONFIG_FILE_PATH, ensureConfigFile } from "./src/config.ts";

const VERSION = pkg.version;
const args = process.argv.slice(2);
const command = args[0];

async function main() {
	if (command === "--help" || command === "-h" || command === "help") {
		console.log(`
Free AI Gateway v${VERSION} — Cổng AI đa nhà cung cấp tương thích OpenAI

Cách dùng:
  free-ai-gateway [lệnh] [tùy chọn]

Lệnh:
  serve              Khởi động máy chủ gateway ở nền trước (mặc định)
  start              Khởi động máy chủ gateway ở nền sau (daemon)
  stop               Dừng máy chủ gateway đang chạy ở nền sau
  restart            Khởi động lại máy chủ gateway đang chạy ở nền sau
  status             Hiển thị trạng thái máy chủ gateway
  webauth            Trợ lý tương tác phân quyền nhà cung cấp AI
  chrome [start|stop] Khởi động/dừng Chrome ở chế độ remote-debug cho webauth

Tùy chọn:
  --help, -h          Hiển thị thông điệp trợ giúp này
  --version, -v       Hiển thị phiên bản

Biến môi trường (ghi đè file cấu hình):
  FAG_PORT            Cổng máy chủ (mặc định: 20123)
  FAG_API_KEY         Bearer token để xác thực client (tùy chọn, để trống = vô hiệu hóa)
  FAG_CDP_URL         URL cổng Chrome debug (mặc định: http://127.0.0.1:9222)

File cấu hình: ${CONFIG_FILE_PATH} (tự động tạo khi khởi động lần đầu)

Khởi động nhanh:
  1. Cài đặt Chrome (hoặc Chromium) trên máy của bạn
  2. free-ai-gateway webauth    # Phân quyền nhà cung cấp (tự động khởi động Chrome)
  3. free-ai-gateway start      # Khởi động gateway ở nền sau
`);
		process.exit(0);
	}

	if (command === "--version" || command === "-v") {
		console.log(`free-ai-gateway ${VERSION}`);
		process.exit(0);
	}

	// Đảm bảo file cấu hình tồn tại cho mọi lệnh (không gây lỗi, tốt nhất có thể)
	ensureConfigFile();

	if (command === "webauth") {
		await import("./src/cli/webauth.ts");
	} else if (command === "chrome") {
		const { chromeCommand } = await import("./src/cli/chrome.ts");
		await chromeCommand(args[1]);
	} else if (command === "start") {
		const { startDaemon } = await import("./src/cli/daemon.ts");
		await startDaemon();
	} else if (command === "stop") {
		const { stopDaemon } = await import("./src/cli/daemon.ts");
		await stopDaemon();
	} else if (command === "restart") {
		const { restartDaemon } = await import("./src/cli/daemon.ts");
		await restartDaemon();
	} else if (command === "status") {
		const { statusDaemon } = await import("./src/cli/daemon.ts");
		await statusDaemon();
	} else if (!command || command === "serve" || command === "__serve") {
		// Khởi động máy chủ
		await import("./src/server.ts");
	} else {
		console.error(`Lệnh không xác định: ${command}\nChạy 'free-ai-gateway --help' để xem cách dùng.`);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	process.exit(1);
});
