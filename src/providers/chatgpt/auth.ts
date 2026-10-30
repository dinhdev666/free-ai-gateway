import { chromium } from "playwright-core";
import {
	getChromeWebSocketUrl,
	getDefaultCdpUrl,
	getHeadersWithAuth,
} from "../../browser/cdp-helpers.ts";

export interface ChatGPTWebAuth {
	accessToken: string;
	cookie: string;
	userAgent: string;
}

export async function loginChatGPTWeb(params: {
	onProgress: (msg: string) => void;
	openUrl: (url: string) => Promise<boolean>;
}): Promise<ChatGPTWebAuth> {
	const cdpUrl = getDefaultCdpUrl();
	params.onProgress("Đang kết nối tới cổng debug Chrome...");

	let wsUrl: string | null = null;
	for (let i = 0; i < 10; i++) {
		wsUrl = await getChromeWebSocketUrl(cdpUrl, 2000);
		if (wsUrl) break;
		await new Promise((r) => setTimeout(r, 500));
	}
	if (!wsUrl) {
		throw new Error(
			`Không thể kết nối tới Chrome tại ${cdpUrl}. Make sure Chrome is running in debug mode (ví dụ: ./start-chrome-debug.sh)`,
		);
	}

	params.onProgress("Đang kết nối tới trình duyệt...");
	const browser = await chromium.connectOverCDP(wsUrl, {
		headers: getHeadersWithAuth(wsUrl),
	});
	const context = browser.contexts()[0];
	if (!context) throw new Error("Không có browser context khả dụng");
	const page = context.pages()[0] || (await context.newPage());

	await page.goto("https://chatgpt.com/");
	const userAgent = await page.evaluate(() => navigator.userAgent);

	params.onProgress("Vui lòng đăng nhập ChatGPT trong cửa sổ trình duyệt đã mở...");

	return new Promise<ChatGPTWebAuth>((resolve, reject) => {
		let capturedAccessToken: string | undefined;
		let resolved = false;

		const timeout = setTimeout(() => {
			if (!resolved) {
				reject(new Error("Đăng nhập đã hết thời gian (5 phút)."));
			}
		}, 300000);

		const tryResolve = async () => {
			if (resolved) {
				return;
			}

			try {
				const cookies = await context.cookies(["https://chatgpt.com", "https://chat.openai.com"]);
				if (cookies.length === 0) {
					console.log(`[ChatGPT] Chưa tìm thấy cookies trong context.`);
					return;
				}

				const cookieNames = cookies.map((c) => c.name);
				console.log(`[ChatGPT] Tìm thấy cookies: ${cookieNames.join(", ")}`);

				const sessionCookie = cookies.find((c) => c.name === "__Secure-next-auth.session-token");

				let splitToken = "";
				if (!sessionCookie) {
					const token0 = cookies.find((c) => c.name === "__Secure-next-auth.session-token.0");
					const token1 = cookies.find((c) => c.name === "__Secure-next-auth.session-token.1");
					if (token0 && token1) {
						splitToken = token0.value + token1.value;
						console.log(`[ChatGPT] Tìm thấy session token chia đôi (.0 + .1)`);
					}
				}

				if (sessionCookie || capturedAccessToken || splitToken) {
					const finalToken = capturedAccessToken || sessionCookie?.value || splitToken || "";

					if (finalToken) {
						resolved = true;
						clearTimeout(timeout);
						console.log(`[ChatGPT] Access token đã được thu thập!`);

						const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

						resolve({
							accessToken: finalToken,
							cookie: cookieString,
							userAgent,
						});
					} else {
						console.log(`[ChatGPT] Đang chờ session token hợp lệ...`);
					}
				} else {
					console.log(`[ChatGPT] Đang chờ cookie session token...`);
				}
			} catch (e: unknown) {
				console.error(`[ChatGPT] Lỗi khi lấy cookies: ${String(e)}`);
			}
		};

		page.on("request", async (request) => {
			const url = request.url();
			if (url.includes("chatgpt.com") || url.includes("openai.com")) {
				const headers = request.headers();
				const cookie = headers.cookie;

				if (cookie) {
					const tokenMatch = cookie.match(/__Secure-next-auth\.session-token=([^;]+)/);
					if (tokenMatch) {
						if (!capturedAccessToken) {
							console.log(`[ChatGPT] Đã thu thập session token từ request.`);
							capturedAccessToken = tokenMatch[1];
						}
						await tryResolve();
					}
				}
			}
		});

		page.on("response", async (response) => {
			const url = response.url();
			if ((url.includes("chatgpt.com") || url.includes("openai.com")) && response.ok()) {
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

