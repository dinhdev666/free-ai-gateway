import { SessionExpiredError } from "../types.ts";

/**
 * Ném `SessionExpiredError` khi mã trạng thái HTTP cho thấy
 * phiên của nhà cung cấp đã hết hạn (401 / 403).
 *
 * Gọi ngay sau khi kiểm tra `!result.ok` để mọi nhà cung cấp đều
 * nhận được ngữ nghĩa thời gian chờ phiên nhất quán mà không cần
 * lặp lại kiểm tra.
 */
export function throwIfSessionExpired(
	providerId: string,
	status: number | undefined,
	fallbackMessage?: string,
): void {
	if (status === 401 || status === 403) {
		throw new SessionExpiredError(
			providerId,
			fallbackMessage ??
				`Xác thực thất bại (${status}). Chạy lại webauth để làm mới phiên.`,
		);
	}
}

