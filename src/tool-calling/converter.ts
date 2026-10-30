/**
 * Chuyển đổi giữa giao thức công cụ của OpenAI và gọi công cụ dựa trên văn bản web của Claude.
 *
 * Luồng:
 * 1. buildPromptFromMessages: Chuyển OpenAI tools + messages thành một prompt duy nhất
 * 2. parseToolResponse: Phân tích phản hồi văn bản của Claude thành định dạng tool_calls của OpenAI
 * 3. applyToolChoice: Thực thi ngữ nghĩa tool_choice trên cả prompt và phản hồi
 */

import type {
	AssistantMessage,
	ChatMessage,
	ToolCallOutput,
	ToolChoice,
	ToolDefinition,
	ToolMessage,
} from "../openai/types.ts";
import { extractToolCalls, hasToolCall } from "./parser.ts";
import { buildToolPrompt, detectLanguage } from "./prompt.ts";

export interface ConvertedPrompt {
	prompt: string;
	/** Có áp dụng công cụ sau khi xử lý tool_choice */
	hasTools: boolean;
}

function detectLang(messages: ChatMessage[]): "en" | "cn" {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg?.role === "user") {
			const text = typeof msg.content === "string" ? msg.content : "";
			return detectLanguage(text);
		}
	}
	return "en";
}

function extractTextContent(content: string | { type: string; text?: string }[]): string {
	if (typeof content === "string") return content;
	return content
		.filter((p) => p.type === "text")
		.map((p) => p.text ?? "")
		.join("");
}

function formatAssistantMsg(msg: AssistantMessage): string | null {
	if (msg.tool_calls && msg.tool_calls.length > 0) {
		const calls = msg.tool_calls.map(
			(tc) =>
				`\`\`\`tool_json\n{"tool":"${tc.function.name}","parameters":${tc.function.arguments}}\n\`\`\``,
		);
		return `Assistant: [Called tools]\n${calls.join("\n")}`;
	}
	return msg.content ? `Assistant: ${msg.content}` : null;
}

function formatToolResult(msg: ToolMessage): string {
	return [`<tool_result tool_call_id="${msg.tool_call_id}">`, msg.content, "</tool_result>"].join(
		"\n",
	);
}

function formatMessage(msg: ChatMessage): string | null {
	switch (msg.role) {
		case "system":
		case "developer":
			return `System: ${msg.content}`;

		case "user":
			return `Human: ${extractTextContent(msg.content)}`;

		case "assistant":
			return formatAssistantMsg(msg as AssistantMessage);

		case "tool":
			return formatToolResult(msg as ToolMessage);

		// Vai trò "function" cũ của OpenAI → xử lý giống "tool" (hành vi nền tảng)
		default: {
			const legacy = msg as any;
			if (legacy.role === "function" && typeof legacy.content === "string") {
				return formatToolResult({
					role: "tool",
					tool_call_id: legacy.name ?? "unknown",
					content: legacy.content,
				});
			}
			return null;
		}
	}
}

/**
 * Xác định danh sách công cụ có hiệu lực dựa trên tool_choice.
 *
 * - "none" → no tools (empty list)" → không có công cụ (danh sách rỗng)
 * - "auto" / undefined → tất cả công cụ
 * - "required" → tất cả công cụ + gợi ý ép buộc
 * - { function: { name } } → chỉ một công cụ được chỉ định
 */
export function resolveEffectiveTools(
	tools: ToolDefinition[] | undefined,
	toolChoice: ToolChoice | undefined,
): { tools: ToolDefinition[]; forceUse: boolean } {
	if (!tools || tools.length === 0) return { tools: [], forceUse: false };

	if (toolChoice === "none") return { tools: [], forceUse: false };

	if (toolChoice === "required") return { tools, forceUse: true };

	if (typeof toolChoice === "object" && toolChoice.type === "function") {
		const target = toolChoice.function.name;
		const filtered = tools.filter((t) => t.function.name === target);
		return { tools: filtered, forceUse: filtered.length > 0 };
	}

	// "auto" hoặc undefined
	return { tools, forceUse: false };
}

/**
 * Xây dựng một chuỗi prompt duy nhất từ OpenAI messages + tools cho Claude Web.
 */
export function buildPromptFromMessages(
	messages: ChatMessage[],
	tools?: ToolDefinition[],
	toolChoice?: ToolChoice,
): ConvertedPrompt {
	const effective = resolveEffectiveTools(tools, toolChoice);
	const hasTools = effective.tools.length > 0;
	const parts: string[] = [];
	const lang = detectLang(messages);

	if (hasTools) {
		parts.push(buildToolPrompt(effective.tools, lang, effective.forceUse));
	}

	for (const msg of messages) {
		const formatted = formatMessage(msg);
		if (formatted) parts.push(formatted);
	}

	// Khi tin nhắn cuối cùng chứa kết quả tool, thêm gợi ý tiếp tục
	const lastMsg = messages[messages.length - 1];
	const endsWithToolResult = lastMsg?.role === "tool" || (lastMsg as any)?.role === "function";
	if (endsWithToolResult) {
		parts.push(
			lang === "cn"
				? "请根据以上工具执行结果回答用户的问题。"
				: "Please answer the user's question based on the tool results above.",
		);
	}

	return { prompt: parts.join("\n\n"), hasTools };
}

/**
 * Phân tích phản hồi văn bản của Claude và phát hiện tool calls.
 * Trả về tool_calls hoặc content dạng văn bản thường.
 *
 * Khi tool_calls được phát hiện, content được đặt thành null theo chuẩn OpenAI
 * (GPT-4 trả về content: null khi thực hiện tool calls).
 */
export function parseToolResponse(
	text: string,
	requestedTools?: ToolDefinition[],
): {
	content: string | null;
	toolCalls: ToolCallOutput[] | undefined;
	finishReason: "stop" | "tool_calls";
} {
	if (!requestedTools || requestedTools.length === 0 || !hasToolCall(text)) {
		return { content: text, toolCalls: undefined, finishReason: "stop" };
	}

	const validToolNames = new Set(requestedTools.map((t) => t.function.name));
	const parsed = extractToolCalls(text);
	const validCalls = parsed.filter((c) => validToolNames.has(c.name));

	if (validCalls.length === 0) {
		return { content: text, toolCalls: undefined, finishReason: "stop" };
	}

	const toolCalls: ToolCallOutput[] = validCalls.map((call) => ({
		id: `call_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
		type: "function" as const,
		function: {
			name: call.name,
			arguments: JSON.stringify(call.arguments),
		},
	}));

	// Theo chuẩn OpenAI: content là null khi trợ lý tạo ra tool_calls
	return { content: null, toolCalls, finishReason: "tool_calls" };
}

