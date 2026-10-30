import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

// Hàm chờ đợi đơn giản
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Danh sách URL trang đăng nhập của tất cả các nhà cung cấp AI web */
const PROVIDER_URLS = [
	"https://claude.ai/new",
	"https://chatgpt.com",
	"https://chat.deepseek.com/",
	"https://www.doubao.com/chat/",
	"https://chat.qwen.ai",
	"https://www.qianwen.com",
	"https://www.kimi.com",
	"https://gemini.google.com/app",
	"https://grok.com",
	"https://chatglm.cn",
	"https://chat.z.ai/",
	"https://www.perplexity.ai",
	"https://aistudio.xiaomimimo.com",
];

const CDP_PORT = 9222;

function detectChrome(): string | null {
	const platform = process.platform;

	if (platform === "darwin") {
		const candidates = [
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		];
		for (const p of candidates) {
			if (existsSync(p)) return p;
		}
		return null;
	}

	if (platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA ?? "";
		const programFiles = process.env.PROGRAMFILES ?? "";
		const programFilesX86 = process.env["PROGRAMFILES(X86)"] ?? "";
		const candidates = [
			join(localAppData, "Google/Chrome/Application/chrome.exe"),
			join(programFiles, "Google/Chrome/Application/chrome.exe"),
			join(programFilesX86, "Google/Chrome/Application/chrome.exe"),
		];
		for (const p of candidates) {
			if (existsSync(p)) return p;
		}
		return null;
	}

	// Linux / WSL
	const candidates = [
		"/opt/apps/cn.google.chrome-pre/files/google/chrome/google-chrome",
		"/opt/google/chrome/google-chrome",
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
		"/snap/bin/chromium",
	];
	for (const p of candidates) {
		if (existsSync(p)) return p;
	}
	return null;
}

function getUserDataDir(): string {
	const platform = process.platform;
	if (platform === "darwin") {
		return join(homedir(), "Library/Application Support/Chrome-FAG-Debug");
	}
	if (platform === "win32") {
		const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData/Local");
		return join(localAppData, "Chrome-FAG-Debug");
	}
	return join(homedir(), ".config/chrome-FAG-debug");
}

async function waitForCdp(port: number, timeoutMs = 15000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`http://127.0.0.1:${port}/json/version`);
			if (res.ok) return true;
		} catch {}
		process.stdout.write(".");
		await sleep(1000);
	}
	return false;
}

async function isCdpAlreadyRunning(port: number): Promise<boolean> {
	try {
		const res = await fetch(`http://127.0.0.1:${port}/json/version`);
		return res.ok;
	} catch {
		return false;
	}
}

export async function startChrome() {
	if (await isCdpAlreadyRunning(CDP_PORT)) {
		console.log(`Chế độ debug Chrome đã đang chạy trên cổng ${CDP_PORT}.`);
		console.log("Chạy 'free-ai-gateway chrome stop' để dừng phiên bản hiện tại trước.");
		return;
	}

	const chromePath = detectChrome();
	if (!chromePath) {
		console.error(
			"✗ Không tìm thấy Chrome / Chromium.\n  Cài đặt Google Chrome: https://www.google.com/chrome/",
		);
		process.exit(1);
	}

	const userDataDir = getUserDataDir();

	console.log("==========================================");
	console.log("  Free AI Gateway — Chrome Debug Mode");
	console.log("==========================================");
	console.log(`  Chrome  : ${chromePath}`);
 	console.log(`  Hồ sơ : ${userDataDir}`);
	console.log(`  CDP     : http://127.0.0.1:${CDP_PORT}`);
	console.log("");

	const flags = [
		`--remote-debugging-port=${CDP_PORT}`,
		`--user-data-dir=${userDataDir}`,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-background-networking",
		"--disable-sync",
		"--disable-translate",
		"--disable-features=TranslateUI",
		"--remote-allow-origins=*",
		...PROVIDER_URLS,
	];

	const proc = spawn(chromePath, flags, {
		detached: true,
		stdio: "ignore",
	});
	proc.unref();

	console.log("Đang chờ Chrome khởi động");
	const ready = await waitForCdp(CDP_PORT);
	console.log("");

	if (!ready) {
		console.error("✗ Chrome không thể khởi động trong vòng 15 giây.");
		process.exit(1);
	}

	console.log("✓ Chrome đang chạy ở chế độ debug!");
	console.log("");
	console.log("==========================================");
	console.log("  Các bước tiếp theo:");
	console.log("==========================================");
	console.log("  1. Đăng nhập vào mỗi nhà cung cấp trong các tab trình duyệt");
	console.log("     (tất cả trang nhà cung cấp đã được mở tự động)");
	console.log("  2. Chạy: free-ai-gateway webauth");
	console.log("  3. Chạy: free-ai-gateway start");
	console.log("");
	console.log("  Để dừng chế độ Chrome debug:");
	console.log("    free-ai-gateway chrome stop");
	console.log("==========================================");
}

export async function stopChrome() {
	if (process.platform === "win32") {
		const result = spawnSync("powershell", [
			"-Command",
			`Get-NetTCPConnection -LocalPort ${CDP_PORT} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }`,
		]);
		if (result.status === 0) {
			console.log("✓ Đã dừng phiên bản debug Chrome.");
		} else {
			console.log(`Không tìm thấy phiên bản debug Chrome nào trên cổng ${CDP_PORT}.`);
		}
	} else {
		const result = spawnSync("pkill", ["-f", `chrome.*remote-debugging-port=${CDP_PORT}`]);
		if (result.status === 0) {
			console.log("✓ Đã dừng phiên bản debug Chrome.");
		} else {
			console.log("Không tìm thấy phiên bản debug Chrome nào.");
		}
	}
}

export async function chromeCommand(subcommand: string | undefined) {
	if (!subcommand || subcommand === "start") {
		await startChrome();
	} else if (subcommand === "stop") {
		await stopChrome();
	} else {
		console.error(`Lệnh chrome không xác định: ${subcommand}`);
		console.error("Cách dùng: free-ai-gateway chrome [start|stop]");
		process.exit(1);
	}
}
