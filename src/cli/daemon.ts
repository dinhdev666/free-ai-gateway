import { closeSync, openSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { getChromeWebSocketUrl, getDefaultCdpUrl } from "../browser/cdp-helpers.ts";
import { loadConfig } from "../config.ts";
import { startChrome } from "./chrome.ts";

const DATA_DIR = join(homedir(), ".free-ai-gateway");
const PID_FILE = join(DATA_DIR, "gateway.pid");
export const LOG_FILE = join(DATA_DIR, "gateway.log");

// Hàm chờ đợi đơn giản
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function ensureDataDir() {
	await mkdir(DATA_DIR, { recursive: true });
}

function readPid(): number | null {
	try {
		const content = readFileSync(PID_FILE, "utf8");
		const pid = Number.parseInt(content.trim(), 10);
		return Number.isNaN(pid) ? null : pid;
	} catch {
		return null;
	}
}

function isRunning(pid: number): boolean {
	if (process.platform === "win32") {
		// Trên Windows, ngữ nghĩa signal 0 khác biệt; dùng tasklist để kiểm tra
		const result = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], {
			encoding: "utf-8",
		});
		return result.stdout.toString().includes(String(pid));
	}
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

async function removePidFile() {
	try {
		await rm(PID_FILE, { force: true });
	} catch {}
}

/**
 * Xây dựng lệnh spawn sao cho hoạt động cả trong chế độ phát triển
 * (pnpm exec tsx index.ts) và dưới dạng binary đã biên dịch.
 */
function buildSpawnCmd(): string[] {
	const argv0 = process.argv[0] ?? process.execPath;
	const argv1 = process.argv[1] ?? "";
	if (argv1.endsWith(".ts") || argv1.endsWith(".js")) {
		// Chế độ phát triển: tsx index.ts __serve
		return [argv0, argv1, "__serve"];
	}
	// Binary đã biên dịch: ./free-ai-gateway __serve
	return [process.execPath, "__serve"];
}

async function ensureChromeReady(): Promise<void> {
	const cdpUrl = getDefaultCdpUrl();
	const ws = await getChromeWebSocketUrl(cdpUrl, 3000);
	if (ws) {
		console.log("Chế độ Chrome debug: sẵn sàng");
		return;
	}

	console.log("Không phát hiện chế độ Chrome debug, đang khởi động Chrome...");
	try {
		await startChrome();
		// Chờ Chrome trở nên khả dụng
		for (let i = 0; i < 10; i++) {
			await sleep(500);
			if (await getChromeWebSocketUrl(cdpUrl, 2000)) {
				console.log("Chế độ Chrome debug: sẵn sàng");
				return;
			}
		}
		console.warn(
			"Chrome đã khởi động nhưng endpoint CDP chưa khả dụng — cổng truy cập sẽ thử lại khi nhận được yêu cầu đầu tiên",
		);
	} catch (err) {
		console.warn(
			`Không thể tự động khởi động Chrome: ${err instanceof Error ? err.message : String(err)}`,
		);
		console.warn("Vui lòng khởi động Chrome thủ công: free-ai-gateway chrome start");
	}
}

export async function startDaemon() {
	await ensureDataDir();

	const { port } = loadConfig();

	const existing = readPid();
	if (existing && isRunning(existing)) {
		console.log(`Cổng truy cập đã đang chạy (PID: ${existing}) tại http://localhost:${port}`);
		console.log(`Log: ${LOG_FILE}`);
		return;
	}

	await ensureChromeReady();

	const logFd = openSync(LOG_FILE, "a");
	const cmd = buildSpawnCmd();
	const proc = spawn(cmd[0]!, cmd.slice(1), {
		detached: true,
		stdio: ["ignore", logFd, logFd],
		env: process.env as Record<string, string>,
	});
	proc.unref();
	closeSync(logFd);

	await writeFile(PID_FILE, String(proc.pid));
	await sleep(600);

	if (proc.pid && isRunning(proc.pid)) {
		console.log(`Cổng truy cập đã khởi động (PID: ${proc.pid})`);
		console.log(`Đang lắng nghe tại http://localhost:${port}`);
		console.log(`Log: ${LOG_FILE}`);
		console.log("");
		console.log("Cách dùng:");
		console.log(`  curl http://localhost:${port}/v1/models`);
		console.log(`  curl http://localhost:${port}/health`);
		console.log("");
		console.log("Hoặc dùng bất kỳ client SDK OpenAI nào:");
		console.log(`  base_url = "http://localhost:${port}/v1"`);
	} else {
		await removePidFile();
		console.log(`Cổng truy cập không thể khởi động. Kiểm tra log: ${LOG_FILE}`);
		process.exit(1);
	}
}

export async function stopDaemon() {
	const pid = readPid();
	if (!pid) {
		console.log("Cổng truy cập không đang chạy (không tìm thấy file PID)");
		return;
	}

	if (!isRunning(pid)) {
		console.log("Cổng truy cập không đang chạy (file PID lỗi thời, đang dọn dẹp)");
		await removePidFile();
		return;
	}

	if (process.platform === "win32") {
		spawnSync("taskkill", ["/PID", String(pid)], {
			encoding: "utf-8",
		});
	} else {
		process.kill(pid, "SIGTERM");
	}

	// Chờ tối đa 5 giây để tắt một cách nhẹ nhàng
	let waited = 0;
	while (isRunning(pid) && waited < 5000) {
		await sleep(200);
		waited += 200;
	}

	if (isRunning(pid)) {
		if (process.platform === "win32") {
			spawnSync("taskkill", ["/F", "/PID", String(pid)], {
				encoding: "utf-8",
			});
		} else {
			process.kill(pid, "SIGKILL");
		}
		console.log(`Cổng truy cập bị ép buộc dừng (PID: ${pid})`);
	} else {
		console.log(`Cổng truy cập đã dừng (PID: ${pid})`);
	}

	await removePidFile();
}

export async function restartDaemon() {
	await stopDaemon();
	await sleep(300);
	await startDaemon();
}

export async function statusDaemon() {
	const pid = readPid();
	if (!pid) {
		console.log("Cổng truy cập: đã dừng");
		return;
	}
	if (isRunning(pid)) {
		console.log(`Cổng truy cập: đang chạy (PID: ${pid})`);
		console.log(`Log: ${LOG_FILE}`);
	} else {
		console.log("Cổng truy cập: đã dừng (file PID lỗi thời)");
		await removePidFile();
	}
}
