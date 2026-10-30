import type { ModelInfo } from "../types.ts";

/** Cấu hình tĩnh chia sẻ bởi tất cả nhà cung cấp dựa trên API. */
export interface ApiClientConfig {
	hostKey: string;
	startUrl: string;
	cookieDomain: string;
	defaultModel: string;
	models: ModelInfo[];
}

/** Cấu hình tĩnh chia sẻ bởi tất cả nhà cung cấp tương tác DOM. */
export interface DomClientConfig {
	hostKey: string;
	startUrl: string;
	cookieDomain: string;
	models: ModelInfo[];
	/** Số mili giây giữa các lần đụng DOM (mặc định 2000). */
	pollIntervalMs?: number;
	/** Thời gian chờ tối đa để nhận phản hồi (mặc định 120000). */
	maxWaitMs?: number;
	/** Số lần đọc ổn định liên tiếp trước khi chấp nhận (mặc định 2). */
	stabilityThreshold?: number;
}

/** Tham số truyền vào `callApi` / DOM hooks sau khi phân giải model mặc định. */
export interface NormalizedSendParams {
	message: string;
	model: string;
	signal?: AbortSignal;
}

