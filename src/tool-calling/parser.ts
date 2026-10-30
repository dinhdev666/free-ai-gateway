/**
 * Phân tích cú pháp tool calls từ phản hồi văn bản của mô hình web.
 *
 * Được di chuyển từ openclaw-zero-token web-tool-parser.ts.
 * Hỗ trợ nhiều định dạng (thử lần lượt):
 * 1. Fenced: ```tool_json\n{"tool":"...","parameters":{...}}\n```
 * 2. Bare JSON: {"tool":"...","parameters":{...}}
 * 3. XML: <tool_call>{"name":"...","arguments":{...}}</tool_call>
 * 4. OpenAI-native: {"tool_calls":[{"name":"...","arguments":{...}}]}
 */

export interface ParsedToolCall {
	name: string;
	arguments: Record<string, unknown>;
}

const FENCED_REGEX = /```tool_json\s*\n?\s*(\{[\s\S]*\})\s*\n?\s*```/;
const BARE_JSON_REGEX = /\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"parameters"\s*:\s*(\{[\s\S]*?\})\s*\}/;
const XML_TOOL_REGEX = /<tool_call[^>]*>([\s\S]*?)<\/tool_call>/;
const OPENAI_TOOL_CALLS_REGEX =
	/\{\s*"tool_calls"\s*:\s*\[\s*(\{[\s\S]*?\})\s*(?:,[\s\S]*?)?\]\s*\}/;

export function extractToolCalls(text: string): ParsedToolCall[] {
	// Thử trích xuất nhiều XML tool_calls trưực tiên
	const xmlMatches = [...text.matchAll(/<tool_call[^>]*>([\s\S]*?)<\/tool_call>/g)];
	if (xmlMatches.length > 0) {
		const calls: ParsedToolCall[] = [];
		for (const match of xmlMatches) {
			const parsed = parseToolJson(match[1] ?? "");
			if (parsed) calls.push(parsed);
		}
		if (calls.length > 0) return calls;
	}

	// Thử trích xuất đơn lẻ
	const single = extractSingleToolCall(text);
	return single ? [single] : [];
}

export function extractSingleToolCall(text: string): ParsedToolCall | null {
	// 1. Khối mã fenced
	const fenced = FENCED_REGEX.exec(text);
	if (fenced?.[1]) return parseToolJson(fenced[1]);

	// 2. Mảng tool_calls kiểu OpenAI
	const openai = OPENAI_TOOL_CALLS_REGEX.exec(text);
	if (openai?.[1]) return parseToolJson(openai[1]);

	// 3. JSON thuần với tool/parameters
	const bare = BARE_JSON_REGEX.exec(text);
	if (bare?.[1] && bare?.[2]) {
		try {
			return { name: bare[1], arguments: JSON.parse(bare[2]) };
		} catch {
			return null;
		}
	}

	// 4. Định dạng XML
	const xml = XML_TOOL_REGEX.exec(text);
	if (xml?.[1]) return parseToolJson(xml[1]);

	// 5. Sửa lỗi mờ: JSON bị cắt
	const fuzzy = text.match(/\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"parameters"\s*:\s*\{([^}]*)\}/);
	if (fuzzy?.[1] && fuzzy?.[2] !== undefined) {
		const repaired = `{"tool":"${fuzzy[1]}","parameters":{${fuzzy[2]}}}`;
		return parseToolJson(repaired);
	}

	return null;
}

function parseToolJson(raw: string): ParsedToolCall | null {
	try {
		let cleaned = raw.trim();
		// Tự sửa dấu ngoặc nhọn không cân
		const opens = (cleaned.match(/\{/g) || []).length;
		const closes = (cleaned.match(/\}/g) || []).length;
		if (opens > closes) {
			cleaned += "}".repeat(opens - closes);
		}

		const obj = JSON.parse(cleaned);

		// Định dạng: {"tool":"name","parameters":{...}}
		if (typeof obj.tool === "string") {
			return { name: obj.tool, arguments: obj.parameters ?? {} };
		}
		// Định dạng: {"name":"...","arguments":{...}}
		if (typeof obj.name === "string") {
			return { name: obj.name, arguments: obj.arguments ?? {} };
		}

		return null;
	} catch {
		return null;
	}
}

export function hasToolCall(text: string): boolean {
	return (
		FENCED_REGEX.test(text) ||
		BARE_JSON_REGEX.test(text) ||
		XML_TOOL_REGEX.test(text) ||
		OPENAI_TOOL_CALLS_REGEX.test(text)
	);
}

