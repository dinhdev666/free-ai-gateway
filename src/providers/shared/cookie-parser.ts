export interface BrowserCookie {
	name: string;
	value: string;
	domain: string;
	path: string;
	secure?: boolean;
}

/**
 * Phân tích chuỗi header `Cookie` thô thành mảng đối tượng cookie trình duyệt
 * phù hợp với `BrowserManager.addCookies()`.
 *
 * Xử lý giá trị chứa dấu `=` (ví dụ: token base64) bằng cách nối lại
 * mọi thứ sau dấu `=` đầu tiên. Bỏ qua các mảnh không có `=` và các mục
 * có tên rỗng. Chuỗi dạng JSON (`{...}`) bị từ chối ngay — người gọi
 * nên tự phân tích trước.
 */
export function parseCookieHeader(cookieStr: string, domain: string): BrowserCookie[] {
	if (!cookieStr?.trim() || cookieStr.startsWith("{")) return [];
	return cookieStr
		.split(";")
		.filter((c) => c.trim().includes("="))
		.map((c) => {
			const [name, ...valueParts] = c.trim().split("=");
			return {
				name: name?.trim() ?? "",
				value: valueParts.join("=").trim(),
				domain,
				path: "/",
			};
		})
		.filter((c) => c.name.length > 0);
}

