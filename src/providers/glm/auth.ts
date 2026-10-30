import { chromium } from "playwright-core";
import {
	getChromeWebSocketUrl,
	getDefaultCdpUrl,
	getHeadersWithAuth,
} from "../../browser/cdp-helpers.ts";

export interface GlmWebAuth {
	cookie: string;
	userAgent: string;
}

export async function loginGlmWeb(params: {
	onProgress: (msg: string) => void;
	openUrl: (url: string) => Promise<boolean>;
}): Promise<GlmWebAuth> {
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
			`Không thể kết nối tới Chrome tại ${cdpUrl}. Đảm bảo Chrome đang chạy ở chế độ debug (./start-chrome-debug.sh)`,
		);
	}

	params.onProgress("Đang kết nối tới trình duyệt...");
	const browser = await chromium.connectOverCDP(wsUrl, {
		headers: getHeadersWithAuth(wsUrl),
	});
	const context = browser.contexts()[0];
	if (!context) throw new Error("Không có browser context khả dụng");
	const page = context.pages()[0] || (await context.newPage());

	params.onProgress("Điều hướng tới ChatGLM...");
	await page.goto("https://chatglm.cn", { waitUntil: "domcontentloaded" });

	const userAgent = await page.evaluate(() => navigator.userAgent);
	params.onProgress("Vui lòng đăng nhập ChatGLM trong cửa sổ trình duyệt đã mở...");
	params.onProgress("Đang chờ xác thực (cookie chatglm_refresh_token)...");

	await page.waitForFunction(
		() => {
			return document.cookie.includes("chatglm_refresh_token");
		},
		{ timeout: 300000 },
	);

	params.onProgress("Phát hiện đăng nhập, đang thu thập cookies...");
	const cookies = await context.cookies("https://chatglm.cn");
	const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
	params.onProgress("Xác thựng thành công!");

	return { cookie: cookieString, userAgent };
}

