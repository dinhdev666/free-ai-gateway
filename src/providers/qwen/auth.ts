import { chromium } from "playwright-core";
import {
	getChromeWebSocketUrl,
	getDefaultCdpUrl,
	getHeadersWithAuth,
} from "../../browser/cdp-helpers.ts";

export interface QwenWebAuth {
	sessionToken: string;
	cookie: string;
	userAgent: string;
}

export async function loginQwenWeb(params: {
	onProgress: (msg: string) => void;
	openUrl: (url: string) => Promise<boolean>;
}): Promise<QwenWebAuth> {
	const cdpUrl = getDefaultCdpUrl();
	params.onProgress("Đang kết nối tới cổng debug Chrome...");

	let wsUrl: string | null = null;
	for (let i = 0; i < 10; i++) {
		wsUrl = await getChromeWebSocketUrl(cdpUrl, 2000);
		if (wsUrl) {
			break;
		}
		await new Promise((r) => setTimeout(r, 500));
	}

	if (!wsUrl) {
		throw new Error(`Không thể phân giải URL WebSocket của Chrome từ ${cdpUrl} sau các lần thử.`);
	}

	params.onProgress("Đang kết nối tới trình duyệt...");
	const browser = await chromium.connectOverCDP(wsUrl, {
		headers: getHeadersWithAuth(wsUrl),
		timeout: 60_000,
	});
	const context = browser.contexts()[0];
	if (!context) {
		throw new Error("Không có browser context khả dụng");
	}
	const page = context.pages()[0] || (await context.newPage());

	await page.goto("https://chat.qwen.ai/");
	const userAgent = await page.evaluate(() => navigator.userAgent);

	params.onProgress("Vui lòng đăng nhập Qwen trong cửa sổ trình duyệt đã mở...");

	return await new Promise<QwenWebAuth>((resolve, reject) => {
		let capturedToken: string | undefined;
		let resolved = false;

		const timeout = setTimeout(() => {
			if (!resolved) {
				reject(new Error("Đăng nhập đã hết thời gian (5 phút)."));
			}
		}, 300_000);

		const tryResolve = async () => {
			if (resolved) {
				return;
			}

			try {
				const cookies = await context.cookies(["https://chat.qwen.ai", "https://qwen.ai"]);
				if (cookies.length === 0) {
					console.log(`[Qwen] Chưa tìm thấy cookies trong context.`);
					return;
				}

				const cookieNames = cookies.map((c) => c.name);
				console.log(`[Qwen] Tìm thấy cookies: ${cookieNames.join(", ")}`);

				const sessionCookie = cookies.find(
					(c) => c.name.includes("session") || c.name.includes("token") || c.name.includes("auth"),
				);

				if (sessionCookie || capturedToken) {
					const finalToken = capturedToken || sessionCookie?.value || "";

					if (finalToken && cookies.length > 2) {
						resolved = true;
						clearTimeout(timeout);
						console.log(`[Qwen] Token session đã được thu thập!`);

						const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

						resolve({
							sessionToken: finalToken,
							cookie: cookieString,
							userAgent,
						});
					} else {
						console.log(`[Qwen] Đang chờ session hợp lệ...`);
					}
				} else {
					console.log(`[Qwen] Đang chờ cookie session...`);
				}
			} catch (e: unknown) {
				console.error(`[Qwen] Lỗi khi lấy cookies: ${String(e)}`);
			}
		};

		page.on("request", async (request) => {
			const url = request.url();
			if (url.includes("qwen.ai")) {
				const headers = request.headers();
				const auth = headers.authorization;
				const cookie = headers.cookie;

				if (auth) {
					if (!capturedToken) {
						console.log(`[Qwen] Đã thu thập token ủy quyền từ request.`);
						capturedToken = auth.replace("Bearer ", "");
					}
					await tryResolve();
				} else if (cookie) {
					const tokenMatch = cookie.match(/(?:session|token|auth)[^=]*=([^;]+)/i);
					if (tokenMatch) {
						if (!capturedToken) {
							console.log(`[Qwen] Đã thu thập session từ cookie.`);
							capturedToken = tokenMatch[1];
						}
						await tryResolve();
					}
				}
			}
		});

		page.on("response", async (response) => {
			const url = response.url();
			if (url.includes("qwen.ai") && response.ok()) {
				await tryResolve();
			}
		});

		page.on("close", () => {
			reject(new Error("Cửa sổ trình duyệt đã đóng trước khi đăng nhập được thu thập."));
		});

		const checkInterval = setInterval(async () => {
			await tryResolve();
			if (resolved) {
				clearInterval(checkInterval);
			}
		}, 2000);
	});
}

