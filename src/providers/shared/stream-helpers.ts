/**
 * Bọc một chuỗi (thường là văn bản SSE đệm) thành một ReadableStream<Uint8Array>
 * chứa đúng một khối.
 */
export function textToStream(text: string): ReadableStream<Uint8Array> {
	const bytes = new TextEncoder().encode(text);
	return new ReadableStream({
		start(controller) {
			controller.enqueue(bytes);
			controller.close();
		},
	});
}

