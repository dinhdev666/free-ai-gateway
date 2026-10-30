export interface ModelInfo {
	id: string;
	name: string;
}

export interface StreamResult {
	text: string;
	thinkingText: string;
}

export class SessionExpiredError extends Error {
	constructor(
		public readonly providerId: string,
		message?: string,
	) {
		super(
			message ??
				`Phiên đã hết hạn cho nhà cung cấp "${providerId}". Chạy 'free-ai-gateway webauth' để cấp phép lại.`,
		);
		this.name = "SessionExpiredError";
	}
}

/**
 * Chứa mã trạng thái HTTP phía nhà cung cấp để gateway trả về
 * mã trạng thái HTTP phù hợp cho client (ví dụ: 400 → không retry).
 */
export class ProviderApiError extends Error {
	constructor(
		public readonly httpStatus: number,
		message: string,
	) {
		super(message);
		this.name = "ProviderApiError";
	}
}

export interface WebProviderClient {
	readonly providerId: string;
	init(): Promise<void>;
	sendMessage(params: {
		message: string;
		model?: string;
		signal?: AbortSignal;
	}): Promise<ReadableStream<Uint8Array>>;
	parseStream(
		body: ReadableStream<Uint8Array>,
		onDelta?: (delta: string) => void,
	): Promise<StreamResult>;
	listModels(): ModelInfo[];
	close?(): Promise<void>;
	/** Kiểm tra thời gian chờ phiên một cách nhẹ nhàng (ví dụ: hết hạn cookie, gọi API kiểm tra). */
	checkSession?(): Promise<{ valid: boolean; reason?: string }>;
}

export type WebProviderFactory = (credentials: unknown) => WebProviderClient;

/**
 * Đưa một promise vào đối đầu với thời gian chờ. Từ chối với thông báo lỗi mô tả khi hết thời gian.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "Operation"): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
		),
	]);
}

export interface ProviderDefinition {
	id: string;
	name: string;
	models: ModelInfo[];
	factory: WebProviderFactory;
	loginFn: (params: {
		onProgress: (msg: string) => void;
		openUrl: (url: string) => Promise<boolean>;
	}) => Promise<unknown>;
}

