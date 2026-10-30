import { chromium } from "playwright-core";
import {
	getChromeWebSocketUrl,
	getDefaultCdpUrl,
	getHeadersWithAuth,
} from "../../browser/cdp-helpers.ts";

export interface GrokWebAuth {
	cookie: string;
	userAgent: string;
}

export async function loginGrokWeb(params: {
	onProgress: (msg: string) => void;
	openUrl: (url: string) => Promise<boolean>;
}): Promise<GrokWebAuth> {
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

	onProgress("Điều hướng tới Grok...");
	await page.goto("https://grok.com", { waitUntil: "domcontentloaded" });

	const userAgent = await page.evaluate(() => navigator.userAgent);
	onProgress("Vui lòng đăng nhập Grok trong cửa sổ trình duyệt...");
	onProgress("Đang chờ cookies session...");

	await page.waitForFunction(
		() => document.cookie.includes("sso") || document.cookie.includes("_ga"),
		{ timeout: 300000 },
	);

	onProgress("Phát hiện đăng nhập, đang thu thập cookies...");
	const cookies = await context.cookies("https://grok.com");
	const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
	onProgress("Xác thựng thành công.");

	return { cookie: cookieString, userAgent };
}

