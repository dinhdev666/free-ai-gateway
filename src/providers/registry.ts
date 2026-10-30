/**
 * Registry nhà cung cấp: ánh xạ ID nhà cung cấp và tên model tới các nhà máy WebProviderClient.
 * Tất cả 13 nhà cung cấp AI web đều được đăng ký ở đây với danh mục model của chúng.
 */

import { getCredentials } from "./auth-store.ts";
import type { ModelInfo, ProviderDefinition, WebProviderClient } from "./types.ts";

// Tải lười đối tượng định nghĩa nhà cung cấp để tránh nhập khẩu tất cả nhà cung cấp khi khởi động
let _definitions: ProviderDefinition[] | null = null;

async function loadDefinitions(): Promise<ProviderDefinition[]> {
	if (_definitions) return _definitions;

	const [
		claude,
		chatgpt,
		deepseek,
		doubao,
		gemini,
		glm,
		glmIntl,
		grok,
		kimi,
		perplexity,
		qwen,
		qwenCn,
		xiaomimo,
	] = await Promise.all([
		import("./claude/index.ts"),
		import("./chatgpt/index.ts"),
		import("./deepseek/index.ts"),
		import("./doubao/index.ts"),
		import("./gemini/index.ts"),
		import("./glm/index.ts"),
		import("./glm-intl/index.ts"),
		import("./grok/index.ts"),
		import("./kimi/index.ts"),
		import("./perplexity/index.ts"),
		import("./qwen/index.ts"),
		import("./qwen-cn/index.ts"),
		import("./xiaomimo/index.ts"),
	]);

	_definitions = [
		claude.definition,
		chatgpt.definition,
		deepseek.definition,
		doubao.definition,
		gemini.definition,
		glm.definition,
		glmIntl.definition,
		grok.definition,
		kimi.definition,
		perplexity.definition,
		qwen.definition,
		qwenCn.definition,
		xiaomimo.definition,
	];
	return _definitions;
}

const clientCache = new Map<string, WebProviderClient>();

/**
 * Lưu cache một client nhà cung cấp để lần gọi `getProviderClient` tiếp theo
 * đọc lại credentials từ đĩa và tạo một thể hiện mới.
 * Được gọi tự động khi SessionExpiredError được ném ra.
 */
export function evictProviderClient(providerId: string): void {
	const old = clientCache.get(providerId);
	if (old) {
		old.close?.().catch(() => {});
		clientCache.delete(providerId);
		console.log(`[registry] Đã xóa client cache cho "${providerId}"`);
	}
}

/**
 * Lấy hoặc tạo một client nhà cung cấp cho ID nhà cung cấp đã cho.
 * Trả về null nếu không có credentials nào được lưu cho nhà cung cấp này.
 */
export async function getProviderClient(providerId: string): Promise<WebProviderClient | null> {
	if (clientCache.has(providerId)) return clientCache.get(providerId)!;

	const creds = getCredentials(providerId);
	if (!creds) return null;

	const defs = await loadDefinitions();
	const def = defs.find((d) => d.id === providerId);
	if (!def) return null;

	const client = def.factory(creds);
	await client.init();
	clientCache.set(providerId, client);
	return client;
}

/**
 * Ánh xạ tên model tới ID nhà cung cấp.
 * Hỗ trợ cả ID model trực tiếp ("claude-sonnet-4-6") và
 * định dạng tiền tố ("claude-web/claude-sonnet-4-6").
 */
export async function resolveModelToProvider(model: string): Promise<string | null> {
	const defs = await loadDefinitions();

	// Kiểm tra định dạng tiền tố: "provider-id/model-id"
	if (model.includes("/")) {
		const providerId = model.split("/")[0];
		if (defs.some((d) => d.id === providerId)) return providerId!;
	}

	// Tìm kiếm tất cả nhà cung cấp có model ID khớp
	for (const def of defs) {
		if (def.models.some((m) => m.id === model)) return def.id;
	}

	return null;
}

/**
 * Lấy client cho một tên model cụ thể.
 */
export async function getClientForModel(model: string): Promise<WebProviderClient | null> {
	const providerId = await resolveModelToProvider(model);
	if (!providerId) return null;
	return getProviderClient(providerId);
}

/**
 * Liệt kê tất cả model từ tất cả nhà cung cấp đã xác thực.
 */
export async function listAllModels(): Promise<ModelInfo[]> {
	const defs = await loadDefinitions();
	const models: ModelInfo[] = [];
	for (const def of defs) {
		const creds = getCredentials(def.id);
		if (!creds) continue;
		models.push(...def.models);
	}
	return models;
}

/**
 * Liệt kê tất cả định nghĩa nhà cung cấp (dùng cho trình thái webauth).
 */
export async function listProviderDefinitions(): Promise<ProviderDefinition[]> {
	return loadDefinitions();
}

/**
 * Xóa cache một client nhà cung cấp (ví dụ: sau khi xác thực lại).
 */
export function clearProviderCache(providerId: string): void {
	const client = clientCache.get(providerId);
	if (client?.close) client.close();
	clientCache.delete(providerId);
}

const SESSION_CHECK_TIMEOUT_MS = 10_000;

/**
 * Kiểm tra trạng thái phiên cho tất cả client nhà cung cấp đã lưu trong cache hỗ trợ chức năng này.
 * Mỗi lần kiểm tra được bảo vệ bởi thời gian chờ 10s để /health không bao giờ treo.
 */
export async function checkAllSessions(): Promise<
	Record<string, { valid: boolean; reason?: string }>
> {
	const results: Record<string, { valid: boolean; reason?: string }> = {};
	const entries = [...clientCache.entries()];
	await Promise.all(
		entries.map(async ([id, client]) => {
			if (!client.checkSession) {
				results[id] = { valid: true, reason: "chưa kiểm tra" };
				return;
			}
			try {
				const race = Promise.race([
					client.checkSession(),
					new Promise<{ valid: false; reason: string }>((resolve) =>
						setTimeout(
							() => resolve({ valid: false, reason: "kiểm tra phiên bị quá thời gian" }),
							SESSION_CHECK_TIMEOUT_MS,
						),
					),
				]);
				results[id] = await race;
			} catch (err) {
				results[id] = { valid: false, reason: err instanceof Error ? err.message : String(err) };
			}
		}),
	);
	return results;
}

