/** Kết quả phân biệt được trả về từ `page.evaluate` fetch wrapper. */
export type EvalResult<T = string> =
	| { ok: true; data: T }
	| { ok: false; status: number; error: string };

/**
 * Đối đầu một promise evaluate với thời gian chờ tường thời ở phía Node.
 * Nếu evaluate bị treo (ví dụ: tab trình duyệt đóng băng), người gọi
 * vẫn nhận được một rejection sạch.
 */
export function withEvalTimeout<T>(
	evalPromise: Promise<T>,
	timeoutMs: number,
	label: string,
): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return Promise.race([
		evalPromise,
		new Promise<never>((_, reject) => {
			timer = setTimeout(
				() => reject(new Error(`${label} đã hết thời gian chờ sau ${timeoutMs / 1000}s`)),
				timeoutMs,
			);
		}),
	]).finally(() => {
		if (timer) clearTimeout(timer);
	});
}

/**
 * Đối đầu một promise với AbortSignal. Nếu không có signal nào,
 * promise gốc sẽ được trả về nguyên trạng.
 */
export function raceAbortSignal<T>(
	promise: Promise<T>,
	signal: AbortSignal | undefined,
	label: string,
): Promise<T> {
	if (!signal) return promise;
	if (signal.aborted) return Promise.reject(new Error(`${label} đã bị hủy bỏ`));
	return Promise.race([
		promise,
		new Promise<never>((_, reject) => {
			signal.addEventListener("abort", () => reject(new Error(`${label} đã bị hủy bỏ`)), { once: true });
		}),
	]);
}

