const UNAUTHORIZED = Response.json(
	{ error: { message: "Unauthorized", type: "unauthorized" } },
	{ status: 401 },
);

/**
 * Xác thực Bearer token đơn giản.
 * Nếu FAG_API_KEY / config.apiKey không được thiết lập, tất cả yêu cầu đều được cho phép.
 */
export function authenticate(req: Request, apiKey: string | undefined): Response | null {
	if (!apiKey) return null;
	const auth = req.headers.get("authorization") ?? "";
	if (!auth.toLowerCase().startsWith("bearer ") || auth.slice(7).trim() !== apiKey) {
		return UNAUTHORIZED.clone();
	}
	return null;
}

