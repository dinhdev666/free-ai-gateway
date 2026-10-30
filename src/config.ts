import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface GatewayConfig {
	port: number;
	gatewayApiKey: string | undefined;
	cdpUrl: string;
	/** Thời gian chờ tối đa (giây) cho mỗi yêu cầu tới route /v1/chat/completions. */
	requestTimeoutSec: number;
}

interface ConfigFile {
	port?: number;
	apiKey?: string;
	cdpUrl?: string;
	requestTimeoutSec?: number;
}

const DEFAULTS: Required<ConfigFile> = {
	port: 20123,
	apiKey: "",
	cdpUrl: "http://127.0.0.1:9222",
	requestTimeoutSec: 300,
};

export const CONFIG_FILE_PATH = join(homedir(), ".free-ai-gateway", "config.json");

function loadConfigFile(): ConfigFile {
	try {
		if (existsSync(CONFIG_FILE_PATH)) {
			const raw = readFileSync(CONFIG_FILE_PATH, "utf-8");
			return JSON.parse(raw) as ConfigFile;
		}
	} catch {
		// Bỏ qua file cấu hình bị lỗi cú pháp hoặc không đọc được
	}
	return {};
}

/**
 * Đảm bảo file cấu hình tồn tại và chứa đầy đủ các trường đã biết.
 * - Nếu file chưa tồn tại, tạo file với toàn bộ giá trị mặc định.
 * - Nếu file tồn tại nhưng thiếu các trường thêm trong phiên bản mới,
 *   điền giá trị mặc định để người dùng khám phá và chỉnh sửa mỗi tùy chọn.
 */
export function ensureConfigFile(): void {
	try {
		mkdirSync(dirname(CONFIG_FILE_PATH), { recursive: true });

		if (!existsSync(CONFIG_FILE_PATH)) {
			writeFileSync(CONFIG_FILE_PATH, `${JSON.stringify(DEFAULTS, null, 2)}\n`, "utf-8");
			console.log(`Đã tạo file cấu hình mặc định: ${CONFIG_FILE_PATH}`);
			return;
		}

		const raw = readFileSync(CONFIG_FILE_PATH, "utf-8");
		const existing = JSON.parse(raw) as Record<string, unknown>;
		let patched = false;
		for (const [key, value] of Object.entries(DEFAULTS)) {
			if (!(key in existing)) {
				existing[key] = value;
				patched = true;
			}
		}
		if (patched) {
			writeFileSync(CONFIG_FILE_PATH, `${JSON.stringify(existing, null, 2)}\n`, "utf-8");
			console.log(`Cập nhật file cấu hình với các trường mới: ${CONFIG_FILE_PATH}`);
		}
	} catch {
		// Không nghiêm trọng: file cấu hình là tùy chọn
	}
}

/**
 * Tải cấu hình gateway.
 *
 * Thứ tự ưu tiên (cao nhất trở xuống):
 *   1. Biến môi trường FAG_*
 *   2. <homedir>/.free-ai-gateway/config.json
 *   3. Giá trị mặc định tích hợp
 */
export function loadConfig(): GatewayConfig {
	const file = loadConfigFile();
	return {
		port: Number.parseInt(process.env.FAG_PORT ?? String(file.port ?? DEFAULTS.port), 10),
		gatewayApiKey: (process.env.FAG_API_KEY ?? file.apiKey ?? DEFAULTS.apiKey) || undefined,
		cdpUrl: process.env.FAG_CDP_URL ?? file.cdpUrl ?? DEFAULTS.cdpUrl,
		requestTimeoutSec: Number.parseInt(
			process.env.FAG_REQUEST_TIMEOUT_SEC ??
				String(file.requestTimeoutSec ?? DEFAULTS.requestTimeoutSec),
			10,
		),
	};
}

