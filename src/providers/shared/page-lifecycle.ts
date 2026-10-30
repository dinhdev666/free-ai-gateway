import type { Page } from "playwright-core";
import { BrowserManager } from "../../browser/manager.ts";
import type { BrowserCookie } from "./cookie-parser.ts";

export interface PageConfig {
	hostKey: string;
	startUrl: string;
	cookies: BrowserCookie[];
}

/**
 * Trả về một trang trình duyệt sống cho nhà cung cấp đã cho, tạo mới
 * khi trang trước đã bị đóng hoặc điều hướng đi.
 *
 * 1. Nếu `currentPage` còn sống (readyState đánh giá được), trả về nó.
 * 2. Nếu không, yêu cầu `BrowserManager` tạo một trang mới và tiêm cookies.
 */
export async function ensurePage(currentPage: Page | null, config: PageConfig): Promise<Page> {
	if (currentPage) {
		try {
			await currentPage.evaluate(() => document.readyState);
			return currentPage;
		} catch {
			// Trang đã đóng — tiếp tục
		}
	}

	const bm = BrowserManager.getInstance();
	const page = await bm.getPage(config.hostKey, config.startUrl);
	if (config.cookies.length > 0) {
		await bm.addCookies(config.cookies);
	}
	return page;
}

