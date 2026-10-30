import { chromium } from "playwright-core";
import {
	getChromeWebSocketUrl,
	getDefaultCdpUrl,
	getHeadersWithAuth,
} from "../../browser/cdp-helpers.ts";

export interface GeminiWebAuth {
	cookie: string;
	userAgent: string;
}

export async function loginGeminiWeb(params: {
	onProgress: (msg: string) => void;
	openUrl: (url: string) => Promise<boolean>;
}): Promise<GeminiWebAuth> {
	const onProgress = params.onProgress;
	const cdpUrl = getDefaultCdpUrl();
	onProgress(`Đang kết nối tới Chrome tại ${cdpUrl}...`);

	let wsUrl: string | null = null;
	for (let i = 0; i < 10; i++) {
		wsUrl = await getChromeWebSocketUrl(cdpUrl, 2000);
		if (wsUrl) break;
		await new Promise((r) => setTimeout(r, 500));
	}
	if (!wsUrl) {
		throw new Error(
			`Không thể kết nối tới Chrome tại ${cdpUrl}. Đảm bảo Chrome đang chạy ở chế độ debug.`,
		);
	}

	onProgress("Đang kết nối tới trình duyệt...");
	const browser = await chromium.connectOverCDP(wsUrl, {
		headers: getHeadersWithAuth(wsUrl),
	});
	const context = browser.contexts()[0];
	if (!context) throw new Error("Không có browser context khả dụng");
	const page = context.pages()[0] || (await context.newPage());

	onProgress("Điều hướng tới Gemini...");
	await page.goto("https://gemini.google.com/app", { waitUntil: "domcontentloaded" });

	onProgress("Vui lòng đăng nhập trong cửa sổ trình duyệt...");
	onProgress("Đang chờ cookies xác thực Google...");

	await page.waitForFunction(
		() => document.cookie.includes("SID=") || document.cookie.includes("__Secure-1PSID="),
		{ timeout: 300000 },
	);

	onProgress("Phát hiện đăng nhập, đang thu thập cookies...");
	const cookies = await context.cookies();
	const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
	const userAgent = await page.evaluate(() => navigator.userAgent);
	onProgress("Xác thựng thành công.");

	return { cookie: cookieString, userAgent };
}

