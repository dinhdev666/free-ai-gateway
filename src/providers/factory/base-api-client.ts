import type { Page } from "playwright-core";
import type { BrowserCookie } from "../shared/cookie-parser.ts";
import { throwIfSessionExpired } from "../shared/error-guard.ts";
import type { EvalResult } from "../shared/eval-helpers.ts";
import { ensurePage } from "../shared/page-lifecycle.ts";
import { textToStream } from "../shared/stream-helpers.ts";
import type { ModelInfo, StreamResult, WebProviderClient } from "../types.ts";
import { ProviderApiError } from "../types.ts";
import type { ApiClientConfig, NormalizedSendParams } from "./types.ts";

/**
 * Lớp cơ sở trừu tượng cho các nhà cung cấp web dựa trên API.
 *
 * Các lớp con cung cấp logic `callApi()` riêng biệt cho từng nhà cung cấp,
 * trong khi lớp cơ sở xử lý vòng đời trang, định tuyết lỗi, bọc stream, và
 * liệt kê model.
 *
 * @typeParam TAuth - Dạng thứ cấu trúc trả về từ `getCredentials()`.
 */
export abstract class BaseApiClient<TAuth = unknown> implements WebProviderClient {
	abstract readonly providerId: string;
	protected abstract readonly config: ApiClientConfig;

	protected page: Page | null = null;
	protected readonly auth: TAuth;

	constructor(auth: TAuth) {
		this.auth = auth;
	}

	// ── Các phương thức trừu tượng ───────────────────────────────────

	/** Xây dựng cookie trình duyệt từ thông tin xác thực đã lưu. */
	protected abstract getCookies(): BrowserCookie[];

	/**
	 * Thực thi cuộc gọi API riêng của nhà cung cấp trong trang trình duyệt.
	 * Trả về một `EvalResult` — lớp cơ sở xử lý định tuyết lỗi
	 * và bọc stream.
	 */
	protected abstract callApi(page: Page, params: NormalizedSendParams): Promise<EvalResult>;

	/** Chuyển tiếp sang bộ phân tích SSE / stream riêng của nhà cung cấp. */
	protected abstract parseStreamImpl(
		body: ReadableStream<Uint8Array>,
		onDelta?: (delta: string) => void,
	): Promise<StreamResult>;

	// ── Các hook tùy chọn (ghi đè khi cần) ───────────────────────────

	/** Khởi tạo bổ sung sau khi trang đã sẵn sàng (ví dụ: khám phá org, làm mới token). */
	protected async onInit(): Promise<void> {}

	/**
	 * Được gọi khi `sendMessage` bắt được lỗi. Trả về một stream để
	 * sử dụng đường đi thay thế (ví dụ: DOM fallback); ném lại hoặc
	 * trả về `null` để lan truyền lỗi gốc.
	 */
	protected async handleError(
		err: Error,
		_page: Page,
		_params: NormalizedSendParams,
	): Promise<ReadableStream<Uint8Array> | null> {
		throw err;
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
			model: params.model || this.config.defaultModel,
			signal: params.signal,
		};

		try {
			const result = await this.callApi(page, normalized);
			if (!result.ok) {
				throwIfSessionExpired(this.providerId, result.status);
				const msg = `${this.providerId} lỗi API: ${result.status} - ${result.error}`;
				// Lan truyền lỗi 4xx của nhà cung cấp dưới dạng ProviderApiError
				// để client trả về mã trạng thái tương tự (tránh retry vô nghĩa).
				if (result.status && result.status >= 400 && result.status < 500) {
					throw new ProviderApiError(result.status, msg);
				}
				throw new Error(msg);
			}
			return textToStream(result.data);
		} catch (err) {
			const fallback = await this.handleError(err as Error, page, normalized);
			if (fallback) return fallback;
			throw err;
		}
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

	// ── Các helper được bảo vệ ────────────────────────────────────────────

	/**
	 * Trả về một trang trình duyệt sống, tạo mới thông qua `BrowserManager`
	 * nếu cần thiết. Lớp con có thể ghi đè để khởi tạo trang tùy chỉnh
	 * (ví dụ: chờ oaistatic của ChatGPT).
	 */
	protected async getPage(): Promise<Page> {
		this.page = await ensurePage(this.page, {
			hostKey: this.config.hostKey,
			startUrl: this.config.startUrl,
			cookies: this.getCookies(),
		});
		return this.page;
	}
}

