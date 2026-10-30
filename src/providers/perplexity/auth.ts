import { chromium } from "playwright-core";
import {
	getChromeWebSocketUrl,
	getDefaultCdpUrl,
	getHeadersWithAuth,
} from "../../browser/cdp-helpers.ts";

export interface PerplexityWebAuth {
	cookie: string;
	userAgent: string;
}

export async function loginPerplexityWeb(params: {
	onProgress: (msg: string) => void;
	openUrl: (url: string) => Promise<boolean>;
}): Promise<PerplexityWebAuth> {
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
			`Không thể kết nối tới Chrome tại ${cdpUrl}. Make sure Chrome is running in debug mode (./start-chrome-debug.sh)`,
		);
	}

	params.onProgress("Đang kết nối tới trình duyệt...");
	const browser = await chromium.connectOverCDP(wsUrl, {
		headers: getHeadersWithAuth(wsUrl),
	});
	const context = browser.contexts()[0];
	if (!context) throw new Error("Không có browser context khả dụng");
	const page = context.pages()[0] || (await context.newPage());

	params.onProgress("Điều hướng tới Perplexity...");
	await page.goto("https://www.perplexity.ai", { waitUntil: "domcontentloaded" });

	params.onProgress("Vui lòng đăng nhập trong cửa sổ trình duyệt...");
	params.onProgress("Đang chờ xác thực...");

	await page.waitForFunction(
		() => {
			return (
				document.cookie.includes("__Secure-next-auth.session-token") ||
				document.cookie.includes("intercom_session") ||
				document.cookie.includes("perplexity_") ||
				document.cookie.includes("next-auth.session-token") ||
				(window.location.pathname === "/" &&
					!document.querySelector('button[data-testid="login-button"]'))
			);
		},
		{ timeout: 300000 },
	);

	params.onProgress("Phát hiện đăng nhập, đang thu thập cookies...");

	const cookies = await context.cookies();
	const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

	const userAgent = await page.evaluate(() => navigator.userAgent);

	params.onProgress("Xác thựng thành công!");

	return {
		cookie: cookieString,
		userAgent,
	};
}

