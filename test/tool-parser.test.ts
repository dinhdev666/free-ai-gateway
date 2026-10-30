import { describe, expect, test } from "vitest";
import {
	extractSingleToolCall,
	extractToolCalls,
	hasToolCall,
} from "../src/tool-calling/parser.ts";

describe("extractSingleToolCall", () => {
	test("phân tích khối tool_json được bao quanh bởi fenced", () => {
		const text = `Sure, I'll search for that.

\`\`\`tool_json
{"tool":"web_search","parameters":{"query":"bun runtime"}}
\`\`\``;
		const result = extractSingleToolCall(text);
		expect(result).toEqual({
			name: "web_search",
			arguments: { query: "bun runtime" },
		});
	});

	test("phân tích JSON thuần với tool/parameters", () => {
		const text = 'I need to run a command. {"tool":"exec","parameters":{"command":"ls -la"}}';
		const result = extractSingleToolCall(text);
		expect(result).toEqual({
			name: "exec",
			arguments: { command: "ls -la" },
		});
	});

	test("phân tích định dạng tool_call XML", () => {
		const text =
			'<tool_call name="read">{"name":"read","arguments":{"path":"/tmp/file.txt"}}</tool_call>';
		const result = extractSingleToolCall(text);
		expect(result).toEqual({
			name: "read",
			arguments: { path: "/tmp/file.txt" },
		});
	});
});

describe("extractToolCalls", () => {
	test("trích xuất nhiều tool_call XML", () => {
		const text =
			'<tool_call name="read">{"name":"read","arguments":{"path":"/tmp/a.txt"}}</tool_call>\n<tool_call name="read">{"name":"read","arguments":{"path":"/tmp/b.txt"}}</tool_call>';
		const result = extractToolCalls(text);
		expect(result).toHaveLength(2);
		expect(result[0]?.name).toBe("read");
		expect(result[0]?.arguments.path).toBe("/tmp/a.txt");
		expect(result[1]?.arguments.path).toBe("/tmp/b.txt");
	});

	test("trả về mảng rỗng khi không có tool call nào", () => {
		const result = extractToolCalls("Không có tool call nào ở đây");
		expect(result).toEqual([]);
	});
});

describe("hasToolCall", () => {
	test("trả về true cho fenced tool_json", () => {
		expect(hasToolCall("```tool_json\n{\"tool\":\"x\",\"parameters\":{}}\n```")).toBe(true);
	});

	test("trả về false cho văn bản thường", () => {
		expect(hasToolCall("Chào bạn, hôm nay thời tiết thế nào?")).toBe(false);
	});
});
