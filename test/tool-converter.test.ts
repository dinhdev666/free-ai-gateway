import { describe, expect, test } from "vitest";
import type { ChatMessage, ToolDefinition } from "../src/openai/types.ts";
import {
	buildPromptFromMessages,
	parseToolResponse,
	resolveEffectiveTools,
} from "../src/tool-calling/converter.ts";

const TOOLS: ToolDefinition[] = [
	{
		type: "function",
		function: {
			name: "exec",
			description: "Chạy một lệnh shell",
			parameters: {
				type: "object",
				properties: { command: { type: "string" } },
				required: ["command"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "read",
			description: "Đọc một tệp",
			parameters: {
				type: "object",
				properties: { path: { type: "string" } },
				required: ["path"],
			},
		},
	},
];

describe("resolveEffectiveTools", () => {
	test("auto trả về tất cả công cụ, không ép buộc", () => {
		const result = resolveEffectiveTools(TOOLS, "auto");
		expect(result.tools).toHaveLength(2);
		expect(result.forceUse).toBe(false);
	});

	test("undefined trả về tất cả công cụ, không ép buộc", () => {
		const result = resolveEffectiveTools(TOOLS, undefined);
		expect(result.tools).toHaveLength(2);
		expect(result.forceUse).toBe(false);
	});

	test("none trả về danh sách công cụ rỗng", () => {
		const result = resolveEffectiveTools(TOOLS, "none");
		expect(result.tools).toHaveLength(0);
		expect(result.forceUse).toBe(false);
	});

	test("required trả về tất cả công cụ với forceUse", () => {
		const result = resolveEffectiveTools(TOOLS, "required");
		expect(result.tools).toHaveLength(2);
		expect(result.forceUse).toBe(true);
	});

	test("hàm cụ thể lọc xuống một công cụ với forceUse", () => {
		const result = resolveEffectiveTools(TOOLS, {
			type: "function",
			function: { name: "exec" },
		});
		expect(result.tools).toHaveLength(1);
		expect(result.tools[0]?.function.name).toBe("exec");
		expect(result.forceUse).toBe(true);
	});

	test("hàm cụ thể với tên không tồn tại trả về rỗng", () => {
		const result = resolveEffectiveTools(TOOLS, {
			type: "function",
			function: { name: "nonexistent" },
		});
		expect(result.tools).toHaveLength(0);
		expect(result.forceUse).toBe(false);
	});
});

describe("buildPromptFromMessages", () => {
	test("xây dựng prompt từ tin nhắn người dùng đơn giản", () => {
		const messages: ChatMessage[] = [{ role: "user", content: "Hello" }];
		const { prompt, hasTools } = buildPromptFromMessages(messages);
		expect(prompt).toContain("Human: Hello");
		expect(hasTools).toBe(false);
	});

	test("chèn định nghĩa công cụ khi có tools", () => {
		const messages: ChatMessage[] = [{ role: "user", content: "List files" }];
		const { prompt, hasTools } = buildPromptFromMessages(messages, TOOLS);
		expect(hasTools).toBe(true);
		expect(prompt).toContain("Available tools:");
		expect(prompt).toContain('"exec"');
		expect(prompt).toContain('"read"');
		expect(prompt).toContain("tool_json");
	});

	test("tool_choice none vô hiệu hóa công cụ", () => {
		const messages: ChatMessage[] = [{ role: "user", content: "List files" }];
		const { prompt, hasTools } = buildPromptFromMessages(messages, TOOLS, "none");
		expect(hasTools).toBe(false);
		expect(prompt).not.toContain("Available tools:");
	});

	test("tool_choice required thêm gợi ý ép buộc", () => {
		const messages: ChatMessage[] = [{ role: "user", content: "List files" }];
		const { prompt, hasTools } = buildPromptFromMessages(messages, TOOLS, "required");
		expect(hasTools).toBe(true);
		expect(prompt).toContain("MUST use one of the tools");
	});

	test("tool_choice hàm cụ thể lọc công cụ", () => {
		const messages: ChatMessage[] = [{ role: "user", content: "List files" }];
		const { prompt, hasTools } = buildPromptFromMessages(messages, TOOLS, {
			type: "function",
			function: { name: "exec" },
		});
		expect(hasTools).toBe(true);
		expect(prompt).toContain('"exec"');
		expect(prompt).not.toContain('"read"');
	});

	test("xử lý tin nhắn hệ thống", () => {
		const messages: ChatMessage[] = [
			{ role: "system", content: "You are a helpful assistant" },
			{ role: "user", content: "Hi" },
		];
		const { prompt } = buildPromptFromMessages(messages);
		expect(prompt).toContain("System: You are a helpful assistant");
		expect(prompt).toContain("Human: Hi");
	});

	test("xử lý hội thoại đa lượt có tool calling", () => {
		const messages: ChatMessage[] = [
			{ role: "user", content: "List files" },
			{
				role: "assistant",
				tool_calls: [
					{
						id: "call_1",
						type: "function",
						function: { name: "exec", arguments: '{"command":"ls"}' },
					},
				],
			},
			{ role: "tool", tool_call_id: "call_1", content: "file1.txt\nfile2.txt" },
		];
		const { prompt } = buildPromptFromMessages(messages, TOOLS);
		expect(prompt).toContain("exec");
		expect(prompt).toContain("<tool_result");
		expect(prompt).toContain("call_1");
		expect(prompt).toContain("file1.txt");
	});

	test("xử lý kết quả tool mà không có tools (bước 4 tiếp tục)", () => {
		const messages: ChatMessage[] = [
			{ role: "user", content: "List files" },
			{
				role: "assistant",
				tool_calls: [
					{
						id: "call_1",
						type: "function",
						function: { name: "exec", arguments: '{"command":"ls"}' },
					},
				],
			},
			{ role: "tool", tool_call_id: "call_1", content: "file1.txt\nfile2.txt" },
		];
		// Khi tools không được gửi lại (bước 4), vẫn định dạng đúng
		const { prompt } = buildPromptFromMessages(messages);
		expect(prompt).toContain("file1.txt");
		expect(prompt).toContain("answer");
	});

	test("phát hiện ngôn ngữ tiếng Trung và dùng prompt CN", () => {
		const messages: ChatMessage[] = [{ role: "user", content: "列出当前目录的文件" }];
		const { prompt } = buildPromptFromMessages(messages, TOOLS);
		expect(prompt).toContain("可用工具:");
	});

	test("xử lý vai trò function kế thừa", () => {
		const messages: ChatMessage[] = [
			{ role: "user", content: "Hi" },
			{ role: "function", name: "exec", content: "done" } as any,
		];
		const { prompt } = buildPromptFromMessages(messages);
		expect(prompt).toContain("<tool_result");
		expect(prompt).toContain("done");
	});
});

describe("parseToolResponse", () => {
	test("trả về stop cho văn bản thường không có tool", () => {
		const result = parseToolResponse("Hello, world!", TOOLS);
		expect(result.finishReason).toBe("stop");
		expect(result.content).toBe("Hello, world!");
		expect(result.toolCalls).toBeUndefined();
	});

	test("phân tích tool_json thành tool_calls", () => {
		const text = '```tool_json\n{"tool":"exec","parameters":{"command":"ls"}}\n```';
		const result = parseToolResponse(text, TOOLS);
		expect(result.finishReason).toBe("tool_calls");
		expect(result.toolCalls).toHaveLength(1);
		expect(result.toolCalls?.[0]?.function.name).toBe("exec");
		expect(JSON.parse(result.toolCalls?.[0]?.function.arguments ?? "{}")).toEqual({
			command: "ls",
		});
	});

	test("tool_calls đặt content thành null (chuẩn OpenAI)", () => {
		const text = '```tool_json\n{"tool":"exec","parameters":{"command":"ls"}}\n```';
		const result = parseToolResponse(text, TOOLS);
		expect(result.content).toBeNull();
	});

	test("tool_call id sử dụng định dạng ngẫu nhiên", () => {
		const text = '```tool_json\n{"tool":"exec","parameters":{"command":"ls"}}\n```';
		const result = parseToolResponse(text, TOOLS);
		expect(result.toolCalls?.[0]?.id).toMatch(/^call_[a-f0-9]+$/);
	});

	test("bỏ qua tool calls cho công cụ không có trong yêu cầu", () => {
		const text = '```tool_json\n{"tool":"unknown_tool","parameters":{}}\n```';
		const result = parseToolResponse(text, TOOLS);
		expect(result.finishReason).toBe("stop");
		expect(result.toolCalls).toBeUndefined();
	});

	test("trả về stop khi không có tools được yêu cầu", () => {
		const text = '```tool_json\n{"tool":"exec","parameters":{"command":"ls"}}\n```';
		const result = parseToolResponse(text, undefined);
		expect(result.finishReason).toBe("stop");
		expect(result.content).toBe(text);
	});
});
