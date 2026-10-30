import type { ElementHandle, Page } from "playwright-core";

/**
 * Dán văn bản vào thành phần đang được focus bằng ClipboardEvent ảo.
 * Dùng Ctrl/Cmd+V nếu sự kiện ảo không tạo ra đầu vào hiển thị.
 *
 * Cách tiếp cận này tin cậy hơn page.keyboard.type() cho văn bản dài
 * trong các thành phần contenteditable và rich-text editor.
 */
export async function pasteText(
	page: Page,
	text: string,
	inputHandle?: ElementHandle | null,
): Promise<void> {
	await page.evaluate((t: string) => {
		const dt = new DataTransfer();
		dt.setData("text/plain", t);
		const el = document.activeElement;
		el?.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
	}, text);
	await page.waitForTimeout(400);

	const actual = inputHandle
		? await inputHandle.innerText().catch(() => "")
		: await page.evaluate(() => (document.activeElement as HTMLElement)?.innerText ?? "");

	if (actual.trim().length >= Math.min(text.length * 0.5, 20)) {
		return;
	}

	console.log("[dom-input] paste ảo không thành công, thử lại qua Ctrl+V");
	await page.evaluate(async (t: string) => {
		await navigator.clipboard.writeText(t);
	}, text);
	await page.waitForTimeout(200);
	const mod = process.platform === "darwin" ? "Meta" : "Control";
	await page.keyboard.press(`${mod}+KeyV`);
	await page.waitForTimeout(400);
}

