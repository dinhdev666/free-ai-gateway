import { createServer } from "node:http";
import { Readable } from "node:stream";
import { authenticate } from "./auth.ts";
import { BrowserManager } from "./browser/manager.ts";
import { loadConfig } from "./config.ts";
import { handleChatCompletions, setRouteTimeoutSec } from "./openai/chat-completions.ts";
import { listAuthorizedProviders } from "./providers/auth-store.ts";
import {
	checkAllSessions,
	getClientForModel,
	listAllModels,
	resolveModelToProvider,
} from "./providers/registry.ts";

const config = loadConfig();
setRouteTimeoutSec(config.requestTimeoutSec);

const CORS_HEADERS: Record<string, string> = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function withCors(res: Response): Response {
	const headers: Record<string, string> = {};
	res.headers.forEach((v, k) => {
		headers[k] = v;
	});
	return new Response(res.body, {
		status: res.status,
		statusText: res.statusText,
		headers: { ...headers, ...CORS_HEADERS },
	});
}

async function handleRequest(req: Request): Promise<Response> {
	const { pathname } = new URL(req.url);

	if (req.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: CORS_HEADERS });
	}

	// Kiểm tra sức khỏe là công khai — không cần xác thực (load balancer, giám thị)
	if (pathname === "/health" || pathname === "/healthz") {
		return withCors(await handleHealthRoute());
	}

	const authError = authenticate(req, config.gatewayApiKey);
	if (authError) return withCors(authError);

	if (pathname === "/v1/chat/completions" && req.method === "POST") {
		return withCors(await handleChatCompletionsRoute(req));
	}

	if (pathname === "/v1/models" && req.method === "GET") {
		return withCors(await handleModelsRoute());
	}

	if (pathname.startsWith("/v1/models/") && req.method === "GET") {
		const modelId = decodeURIComponent(pathname.slice("/v1/models/".length));
		return withCors(await handleModelByIdRoute(modelId));
	}

	return withCors(
		Response.json(
			{
				error: {
					message: `Unknown endpoint: ${req.method} ${pathname}`,
					type: "invalid_request_error",
				},
			},
			{ status: 404 },
		),
	);
}

// ── Các bộ xử lý tuyến đường ───────────────────────────────────────────

async function handleHealthRoute(): Promise<Response> {
	const authorized = listAuthorizedProviders();
	const browserHealthy = await BrowserManager.getInstance().isHealthy();
	const sessions = await checkAllSessions();
	const hasExpired = Object.values(sessions).some((s) => !s.valid && s.reason !== "unchecked");
	const overallStatus = !browserHealthy ? "degraded" : hasExpired ? "session_expired" : "ok";
	return Response.json({
		status: overallStatus,
		browser: browserHealthy ? "connected" : "disconnected",
		providers: authorized.length,
		models: (await listAllModels()).length,
		sessions,
	});
}

async function handleChatCompletionsRoute(req: Request): Promise<Response> {
	let body: any;
	try {
		body = await req.json();
	} catch {
		return Response.json(
			{ error: { message: "JSON body không hợp lệ", type: "invalid_request_error" } },
			{ status: 400 },
		);
	}

	const provider = await getClientForModel(body.model || "");
	if (!provider) {
		return Response.json(
			{
				error: {
					message: `Không tìm thấy nhà cung cấp đã ủy quyền cho model "${body.model || ""}". Chạy 'free-ai-gateway webauth' để ủy quyền nhà cung cấp.`,
					type: "invalid_request_error",
				},
			},
			{ status: 404 },
		);
	}

	return handleChatCompletions(body, provider);
}

async function handleModelsRoute(): Promise<Response> {
	const models = await listAllModels();
	const now = Math.floor(Date.now() / 1000);
	const data = await Promise.all(
		models.map(async (m) => ({
			id: m.id,
			object: "model" as const,
			created: now,
			owned_by: (await resolveModelToProvider(m.id)) ?? "web-provider",
		})),
	);
	return Response.json({ object: "list", data });
}

async function handleModelByIdRoute(modelId: string): Promise<Response> {
	const models = await listAllModels();
	const model = models.find((m) => m.id === modelId);
	if (!model) {
		return Response.json(
			{ error: { message: `Model '${modelId}' not found`, type: "invalid_request_error" } },
			{ status: 404 },
		);
	}
	return Response.json({
		id: model.id,
		object: "model",
		created: Math.floor(Date.now() / 1000),
		owned_by: (await resolveModelToProvider(model.id)) ?? "web-provider",
	});
}

// ── Khởi động server ─────────────────────────────────────────────

// Hàm chuyển đổi Node.js IncomingMessage thành Web Request
function nodeReqToWeb(req: import("node:http").IncomingMessage): Request {
	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (value !== undefined) {
			headers.set(key, Array.isArray(value) ? value.join(", ") : value);
		}
	}
	const origin = `http://${req.headers.host ?? "localhost"}`;
	const bodyStream: BodyInit | undefined =
		req.method !== "GET" && req.method !== "HEAD"
			? (Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>)
			: undefined;
	return new Request(`${origin}${req.url ?? "/"}`, {
		method: req.method,
		headers,
		body: bodyStream,
	});
}

const nodeServer = createServer(async (req, res) => {
	const response = await handleRequest(nodeReqToWeb(req));
	const headersObj: Record<string, string> = {};
	response.headers.forEach((value, key) => {
		headersObj[key] = value;
	});
	res.writeHead(response.status, response.statusText, headersObj);
	if (response.body) {
		const reader = response.body.getReader();
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				res.write(Buffer.from(value));
			}
		} finally {
			reader.releaseLock();
		}
	}
	res.end();
});

const listenerPort = config.port;
nodeServer.listen(listenerPort, () => {
	const authorized = listAuthorizedProviders();
	console.log(`Free AI Gateway đang lắng nghe tại http://localhost:${listenerPort}`);
	console.log(`Xác thực: ${config.gatewayApiKey ? "đã bật (Bearer token)" : "đã tắt"}`);
	console.log(`Thời gian chờ yêu cầu: ${config.requestTimeoutSec}s`);
	console.log(
		`Nhà cung cấp đã ủy quyền: ${authorized.length > 0 ? authorized.join(", ") : "không có — chạy 'free-ai-gateway webauth' để ủy quyền"}`,
	);
});

async function gracefulShutdown(signal: string) {
	console.log(`\nĐã nhận ${signal}, đang dừng lại...`);
	await BrowserManager.getInstance().shutdown();
	nodeServer.closeAllConnections();
	nodeServer.close();
	process.exit(0);
}
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

export { nodeServer };
