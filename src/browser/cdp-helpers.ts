/**
 * Các hàm trợ giúp CDP (Chrome DevTools Protocol) tối thiểu để kết nối tới cổng debug của Chrome.
 * Trích xuất từ openclaw-zero-token extensions/browser/src/browser/cdp.helpers.ts
 * và chrome.ts — chỉ những gì thiết yếu cho các luồng webauth.
 */

import { loadConfig } from "../config.ts";

/**
 * Xây dựng header HTTP, chèn Basic auth khi URL chứa thông tin xác thực.
 */
export function getHeadersWithAuth(
	url: string,
	headers: Record<string, string> = {},
): Record<string, string> {
	const merged = { ...headers };
	try {
		const parsed = new URL(url);
		const hasAuth = Object.keys(merged).some((k) => k.toLowerCase() === "authorization");
		if (hasAuth) return merged;
		if (parsed.username || parsed.password) {
			const basic = btoa(`${parsed.username}:${parsed.password}`);
			return { ...merged, Authorization: `Basic ${basic}` };
		}
	} catch {
		// Bỏ qua
	}
	return merged;
}

interface ChromeVersionInfo {
	webSocketDebuggerUrl?: string;
	Browser?: string;
	"User-Agent"?: string;
}

/**
 * Khám phá URL WebSocket của Chrome DevTools thông qua endpoint HTTP `/json/version`.
 * Trả về null nếu Chrome không thể truy cập hoặc không hiển thị URL debugger.
 */
export async function getChromeWebSocketUrl(
	cdpUrl: string,
	timeoutMs = 5000,
): Promise<string | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const versionUrl = `${cdpUrl.replace(/\/$/, "")}/json/version`;
		const headers = getHeadersWithAuth(cdpUrl);
		const res = await fetch(versionUrl, { headers, signal: controller.signal });
		if (!res.ok) return null;
		const data = (await res.json()) as ChromeVersionInfo;
		const wsUrl = data.webSocketDebuggerUrl?.trim();
		if (!wsUrl) return null;
		// Chuẩn hóa: Docker/browserless có thể trả về 0.0.0.0 hoặc :: — thay bằng loopback
		return wsUrl.replace(/ws:\/\/(0\.0\.0\.0|::)/, "ws://127.0.0.1");
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Lấy URL CDP đã cấu hình.
 * Tuân thủ toàn bộ chuỗi ưu tiên: biến môi trường FAG_CDP_URL → config.json → mặc định.
 */
export function getDefaultCdpUrl(): string {
	return loadConfig().cdpUrl;
}

