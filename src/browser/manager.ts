/**
 * Trình quản lý vòng đời trình duyệt tập trung cho tất cả nhà cung cấp AI web.
 * Duy duy trì một kết nối CDP đến Chrome, với tự động kết nối lại,
 * kiểm tra sức khỏe, và khả năng tự động khởi động Chrome.
 */

import type { Browser, BrowserContext, Page } from "playwright-core";
import { chromium } from "playwright-core";
import { getChromeWebSocketUrl, getDefaultCdpUrl, getHeadersWithAuth } from "./cdp-helpers.ts";

export interface BrowserCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	secure?: boolean;
}

class BrowserManager {
	private static instance: BrowserManager | null = null;

	private browser: Browser | null = null;
	private context: BrowserContext | null = null;
	private connecting: Promise<BrowserContext> | null = null;
	private disconnected = false;

	static getInstance(): BrowserManager {
		if (!BrowserManager.instance) {
			BrowserManager.instance = new BrowserManager();
		}
		return BrowserManager.instance;
	}

	/**
	 * Lấy BrowserContext chung, kết nối nếu cần.
	 * Các trình gọi đồng thời chia sẻ cùng một promise kết nối đang chạy.
	 */
	async getContext(): Promise<BrowserContext> {
		if (this.context && !this.disconnected) {
			return this.context;
		}

		if (this.connecting) {
			return this.connecting;
		}

		this.connecting = this.connect();
		try {
			const ctx = await this.connecting;
			return ctx;
		} finally {
			this.connecting = null;
		}
	}

	/**
	 * Lấy hoặc tạo một tab trang cho domain đã cho.
	 * Tái sử dụng một tab đã tồn tại mà URL chứa domain.
	 */
	async getPage(domain: string, fallbackUrl?: string): Promise<Page> {
		const ctx = await this.getContext();
		const pages = ctx.pages();
		const existing = pages.find((p) => p.url().includes(domain));
		if (existing) return existing;

		const page = await ctx.newPage();
		if (fallbackUrl) {
			await page.goto(fallbackUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
		}
		return page;
	}

	/**
	 * Tiêm cookies vào BrowserContext chung.
	 */
	async addCookies(cookies: BrowserCookie[]): Promise<void> {
		const ctx = await this.getContext();
		if (cookies.length > 0) {
			try {
				await ctx.addCookies(cookies);
			} catch (err) {
				console.warn(
					`[BrowserManager] addCookies thất bại: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}
	}

	/**
	 * Kiểm tra Chrome có thể truy cập và kết nối CDP còn sống không.
	 */
	async isHealthy(): Promise<boolean> {
		if (this.disconnected || !this.browser || !this.context) {
			// Thử một kết nối CDP nhẹ ngay cả khi chưa có kết nối hoạt động
			const cdpUrl = getDefaultCdpUrl();
			const ws = await getChromeWebSocketUrl(cdpUrl, 3000);
			return ws !== null;
		}

		try {
			// Xác nhận context còn phản hồi
			const pages = this.context.pages();
			return pages.length >= 0; // sẽ ném lỗi nếu đã ngắt kết nối
		} catch {
			return false;
		}
	}

	/**
	 * Tắt kết nối một cách nhẹ nhàng: ngắt kết nối khỏi Chrome mà không kết thúc quá trình.
	 */
	async shutdown(): Promise<void> {
		if (this.browser) {
			try {
				this.browser.removeAllListeners("disconnected");
				await this.browser.close().catch(() => {});
			} catch {
				// Bỏ qua
			}
		}
		this.browser = null;
		this.context = null;
		this.disconnected = true;
		this.connecting = null;
	}

	// ── nội bộ ──────────────────────────────────────────────────────

	private async connect(): Promise<BrowserContext> {
		const cdpUrl = getDefaultCdpUrl();
		console.log(`[BrowserManager] Đang kết nối tới Chrome tại ${cdpUrl}...`);

		let wsUrl: string | null = null;
		for (let attempt = 0; attempt < 15; attempt++) {
			wsUrl = await getChromeWebSocketUrl(cdpUrl, 2000);
			if (wsUrl) break;

			// Khi thất bại lần đầu, thử tự động khởi động Chrome
			if (attempt === 2) {
				await this.tryAutoStartChrome();
			}

			await new Promise((r) => setTimeout(r, 1000));
		}

		if (!wsUrl) {
			throw new Error(
				`[BrowserManager] Không thể kết nối tới Chrome tại ${cdpUrl}. ` +
					"Hãy đảm bảo Chrome đang chạy ở chế độ debug (free-ai-gateway chrome start).",
			);
		}

		const browser = await chromium.connectOverCDP(wsUrl, {
			headers: getHeadersWithAuth(wsUrl),
		});

		const ctx = browser.contexts()[0];
		if (!ctx) {
			throw new Error("[BrowserManager] Kết nối CDP không trả về context trình duyệt");
		}

		this.browser = browser;
		this.context = ctx;
		this.disconnected = false;

		browser.on("disconnected", () => {
			console.warn("[BrowserManager] Chrome đã ngắt kết nối. Sẽ tự động kết nối lại trên yêu cầu tiếp theo.");
			this.browser = null;
			this.context = null;
			this.disconnected = true;
		});

		const pageCount = ctx.pages().length;
		console.log(
			`[BrowserManager] Kết nối thành công (${pageCount} tab đã tồn tại${pageCount !== 1 ? "s" : ""})`,
		);

		return ctx;
	}

	private async tryAutoStartChrome(): Promise<void> {
		try {
			console.log("[BrowserManager] Chrome không thể truy cập, đang thử khởi động tự động...");
			const { startChrome } = await import("../cli/chrome.ts");
			await startChrome();
		} catch (err) {
			console.warn(
				`[BrowserManager] Khởi động tự động thất bại: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}

export { BrowserManager };
