import { chromium } from "playwright-core";
import {
	getChromeWebSocketUrl,
	getDefaultCdpUrl,
	getHeadersWithAuth,
} from "../../browser/cdp-helpers.ts";

export interface XiaomiMimoWebAuth {
	cookie: string;
	userAgent: string;
}

const XIAOMIMO_AUTH_URL = "https://aistudio.xiaomimimo.com/#/";

export async function loginXiaomiMimoWeb(params: {
	onProgress: (msg: string) => void;
	openUrl: (url: string) => Promise<boolean>;
}): Promise<XiaomiMimoWebAuth> {
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
	let page = context.pages()[0];

	if (!page) {
		page = await context.newPage();
	} else {
		const existingPage = context.pages().find((p) => p.url().includes("xiaomimimo.com"));
		if (existingPage) {
			page = existingPage;
		}
	}

	params.onProgress(`Đang mở ${XIAOMIMO_AUTH_URL}...`);
	await params.openUrl(XIAOMIMO_AUTH_URL);

	await page
		.goto(XIAOMIMO_AUTH_URL, { waitUntil: "domcontentloaded", timeout: 15_000 })
		.catch(() => {});

	const userAgent = await page.evaluate(() => navigator.userAgent);
	params.onProgress("Vui lòng đăng nhập Xiaomi MiMo trong cửa sổ trình duyệt đã mở...");
	params.onProgress("Đang chờ token xác thực...");

	return await new Promise<XiaomiMimoWebAuth>((resolve, reject) => {
		let capturedToken: string | undefined;
		let resolved = false;
		let checkInterval: ReturnType<typeof setInterval> | undefined;

		const timeout = setTimeout(() => {
			if (!resolved) {
				if (checkInterval) {
					clearInterval(checkInterval);
				}
				reject(new Error("Đăng nhập đã hết thời gian (5 phút)."));
			}
		}, 300_000);

		const tryResolve = async () => {
			if (resolved) {
				return;
			}

			try {
				const cookies = await context.cookies(["https://aistudio.xiaomimimo.com"]);
				if (cookies.length === 0) {
					return;
				}

				const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
				console.log(
					`[XiaomiMimo] Found ${cookies.length} cookies: ${cookies.map((c) => c.name).join(", ")}`,
				);

				const tokenCookie = cookies.find(
					(c) =>
						c.name.toLowerCase().includes("token") ||
						c.name.toLowerCase().includes("session") ||
						c.name.toLowerCase().includes("auth") ||
						c.name.toLowerCase().includes("user"),
				);

				if (tokenCookie || capturedToken) {
					const finalToken = capturedToken || tokenCookie?.value || "";
					if (finalToken && cookies.length > 1) {
						resolved = true;
						clearTimeout(timeout);
						if (checkInterval) {
							clearInterval(checkInterval);
						}
						console.log(`[XiaomiMimo] Token xác thực đã được thu thập!`);
						resolve({
							cookie: cookieString,
							userAgent,
						});
					}
				} else {
					console.log(`[XiaomiMimo] Đang chờ cookie token... (${cookies.length} cookie)`);
				}
			} catch (e: unknown) {
				console.error(`[XiaomiMimo] Lỗi khi lấy cookies: ${String(e)}`);
			}
		};

		page.on("request", async (request) => {
			const url = request.url();
			if (url.includes("xiaomimimo.com")) {
				const headers = request.headers();
				const auth = headers.authorization || headers.Authorization;
				const cookie = headers.cookie || headers.Cookie;

				if (auth?.startsWith("Bearer ")) {
					if (!capturedToken) {
						console.log(`[XiaomiMimo] Đã thu thập Bearer token từ request header.`);
						capturedToken = auth.replace("Bearer ", "");
					}
					void tryResolve();
				} else if (cookie) {
					const tokenMatch = cookie.match(/(?:token|session|auth|user)[^=]*=([^;]+)/i);
					if (tokenMatch && !capturedToken) {
						console.log(`[XiaomiMimo] Đã thu thập token từ cookie header.`);
						capturedToken = tokenMatch[1];
						void tryResolve();
					}
				}
			}
		});

		page.on("response", async (response) => {
			const url = response.url();
			if (url.includes("xiaomimimo.com") && response.ok()) {
				try {
					const ct = response.headers()["content-type"] || "";
					if (ct.includes("application/json")) {
						const text = await response.text().catch(() => "");
						if (text) {
							const tokenMatch = text.match(/(?:token|session|auth|access_token)[^"]*"([^"]+)"/i);
							if (tokenMatch && !capturedToken) {
								console.log(`[XiaomiMimo] Đã thu thập từ phần thân phản hồi.`);
								capturedToken = tokenMatch[1];
								void tryResolve();
							}
						}
					}
				} catch {}
				void tryResolve();
			}
		});

		page.on("framenavigated", async () => {
			try {
				const storageData = await page.evaluate(() => {
					const data: Record<string, string> = {};
					try {
						for (let i = 0; i < localStorage.length; i++) {
							const key = localStorage.key(i);
							if (key) {
								const val = localStorage.getItem(key);
								if (val) {
									data[key] = val;
								}
							}
						}
					} catch {}
					return data;
				});

				for (const [key, value] of Object.entries(storageData)) {
					const k = key.toLowerCase();
					if (
						k.includes("token") ||
						k.includes("session") ||
						k.includes("auth") ||
						k.includes("user")
					) {
						try {
							const parsed = JSON.parse(value) as {
								token?: string;
								access_token?: string;
								data?: string;
							};
							const token = parsed?.token || parsed?.access_token || parsed?.data || value;
							if (typeof token === "string" && token.length > 10 && !capturedToken) {
								console.log(`[XiaomiMimo] Đã thu thập từ localStorage key: ${key}`);
								capturedToken = token;
								void tryResolve();
							}
						} catch {
							if (value.length > 10 && !capturedToken) {
								console.log(`[XiaomiMimo] Đã thu thập từ localStorage key: ${key}`);
								capturedToken = value;
								void tryResolve();
							}
						}
					}
				}
			} catch {}
		});

		page.on("close", () => {
			if (checkInterval) {
				clearInterval(checkInterval);
			}
			reject(new Error("Cửa sổ trình duyệt đã đóng trước khi đăng nhập được thu thập."));
		});

		checkInterval = setInterval(tryResolve, 2000);
	});
}

