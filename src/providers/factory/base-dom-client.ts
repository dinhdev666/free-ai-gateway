import type { Page } from "playwright-core";
import type { BrowserCookie } from "../shared/cookie-parser.ts";
import { ensurePage } from "../shared/page-lifecycle.ts";
import { textToStream } from "../shared/stream-helpers.ts";
import type { ModelInfo, StreamResult, WebProviderClient } from "../types.ts";
import type { DomClientConfig, NormalizedSendParams } from "./types.ts";

/**
 * Lớp cơ sở trừu tượng cho các nhà cung cấp web tương tác DOM (Gemini, GLM-Intl,
 * Perplexity, v.v.).
 *
 * Các lớp con triển khai `sendViaDom()` xử lý tìm kiếm input, dán tin nhắn,
 * nhấn Enter và thu thập văn bản phản hồi. Lớp cơ sở cung cấp
 * `pollForStableText()` tái sử dụng và xử lý vòng đời trang, bọc stream,
 * liệt kê model và dọn dẹp.
 *
 * @typeParam TAuth - Dạng thứ cấu trúc trả về từ `getCredentials()`.
 */
export abstract class BaseDomClient<TAuth = unknown> implements WebProviderClient {
	abstract readonly providerId: string;
	protected abstract readonly config: DomClientConfig;

	protected page: Page | null = null;
	protected readonly auth: TAuth;

	constructor(auth: TAuth) {
		this.auth = auth;
	}

	// ── Các phương thức trừu tượng ───────────────────────────────────

	protected abstract getCookies(): BrowserCookie[];

	/**
	 * Thực hiện toàn bộ tương tác DOM: tìm phần tử input, dán tin nhắn,
	 * gửi, đợi và trả về văn bản phản hồi của trợ lý.
	 *
	 * Dùng `this.pollForStableText()` cho vòng lặp chờ đến khi ổn định.
	 */
	protected abstract sendViaDom(page: Page, params: NormalizedSendParams): Promise<string>;

	protected abstract parseStreamImpl(
		body: ReadableStream<Uint8Array>,
		onDelta?: (delta: string) => void,
	): Promise<StreamResult>;

	// ── Các hook tùy chọn ──────────────────────────────────────────────

	/** Khởi tạo bổ sung. */
	protected async onInit(): Promise<void> {}

	/** Xây dựng payload SSE từ văn bản đã bắt được. Ghi đè để tùy chỉnh. */
	protected formatSsePayload(text: string): string {
		return `data: ${JSON.stringify({ text })}\n\n`;
	}

	// ── Cài đặt WebProviderClient công khai ─────────────────────────

	async init(): Promise<void> {
		await this.getPage();
		await this.onInit();
	}

	async sendMessage(params: {
		message: string;
		model?: string;
		signal?: AbortSignal;
	}): Promise<ReadableStream<Uint8Array>> {
		const page = await this.getPage();
		const normalized: NormalizedSendParams = {
			message: params.message,
			model: params.model || this.config.models[0]?.id || "default",
			signal: params.signal,
		};

		const text = await this.sendViaDom(page, normalized);
		if (!text) {
			throw new Error(
				`${this.providerId}: không phát hiện phản hồi của trợ lý. Đảm bảo trang web có thể truy cập và bạn đã đăng nhập.`,
			);
		}
		return textToStream(this.formatSsePayload(text));
	}

	async parseStream(
		body: ReadableStream<Uint8Array>,
		onDelta?: (delta: string) => void,
	): Promise<StreamResult> {
		return this.parseStreamImpl(body, onDelta);
	}

	listModels(): ModelInfo[] {
		return this.config.models;
	}

	async close(): Promise<void> {
		this.page = null;
	}

	// ── Các helper được bảo vệ ──────────────────────────────────────────

	protected async getPage(): Promise<Page> {
		this.page = await ensurePage(this.page, {
			hostKey: this.config.hostKey,
			startUrl: this.config.startUrl,
			cookies: this.getCookies(),
		});
		return this.page;
	}

	/**
	 * Kiểm tra trang cho đến khi văn bản trích xuất ổn định trong
	 * `config.stabilityThreshold` lần đọc liên tiếp (mặc định: 2).
	 *
	 * @param extractFn - Gọi mỗi vòng lặp để lấy văn bản phản hồi hiện tại
	 *   từ DOM. Trả về chuỗi rỗng khi chưa có phản hồi hiển thị.
	 */
	protected async pollForStableText(
		extractFn: () => Promise<string>,
		signal?: AbortSignal,
	): Promise<string> {
		const interval = this.config.pollIntervalMs ?? 2000;
		const maxWait = this.config.maxWaitMs ?? 120_000;
		const threshold = this.config.stabilityThreshold ?? 2;

		let lastText = "";
		let stableCount = 0;

		for (let elapsed = 0; elapsed < maxWait; elapsed += interval) {
			if (signal?.aborted) throw new Error(`${this.providerId} request aborted`);
			await new Promise<void>((r) => setTimeout(r, interval));

			const text = await extractFn();
			if (text && text.length >= 2) {
				if (text !== lastText) {
					lastText = text;
					stableCount = 0;
				} else {
					stableCount++;
					if (stableCount >= threshold) break;
				}
			}
		}

		return lastText;
	}
}

