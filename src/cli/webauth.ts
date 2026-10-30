/**
 * Trình thủ công xác thực nhà cung cấp AI web.
 * Hướng dẫn người dùng xác thực với các nhà cung cấp AI web thông qua Chrome CDP.
 * Tự động khởi động Chrome ở chế độ debug nếu chưa chạy.
 *
 * Cách dùng: pnpm run webauth
 */

import { createInterface } from "node:readline";
import { loadConfig } from "../config.ts";
import { listAuthorizedProviders, saveCredentials } from "../providers/auth-store.ts";
import { listProviderDefinitions } from "../providers/registry.ts";

function question(rl: ReturnType<typeof createInterface>, prompt: string): Promise<string> {
	return new Promise((resolve) => rl.question(prompt, resolve));
}

async function isChromeReady(): Promise<boolean> {
	const cdpUrl = loadConfig().cdpUrl;
	try {
		const res = await fetch(`${cdpUrl}/json/version`);
		return res.ok;
	} catch {
		return false;
	}
}

async function main() {
	console.log("\n🌐 Free AI Gateway — Trợ lý phân quyền nhà cung cấp AI\n");

	if (!(await isChromeReady())) {
		console.log("Chế độ debug Chrome chưa chạy. Đang khởi động Chrome tự động...\n");
		const { startChrome } = await import("./chrome.ts");
		await startChrome();
		const rl0 = createInterface({ input: process.stdin, output: process.stdout });
		await question(
			rl0,
			"\nVui lòng đăng nhập vào từng nhà cung cấp trong các tab trình duyệt, sau đó nhấn Enter để tiếp tục: ",
		);
		rl0.close();
		console.log("");
	}

	const definitions = await listProviderDefinitions();
	const authorized = listAuthorizedProviders();

	if (authorized.length > 0) {
		console.log("Nhà cung cấp đã được phân quyền:");
		for (const id of authorized) {
			const def = definitions.find((d) => d.id === id);
			console.log(`  ✓ ${def?.name ?? id}`);
		}
		console.log("");
	}

	console.log("Chọn nhà cung cấp để phân quyền (phân tách bằng dấu phẩy):\n");

	for (let i = 0; i < definitions.length; i++) {
		const def = definitions[i]!;
		const status = authorized.includes(def.id) ? " ✓" : "";
		console.log(`  ${i + 1}. ${def.name}${status}`);
	}

	console.log("\n  0. Thoát");
	console.log("  a. Phân quyền tất cả");
	console.log("");

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const input = await question(rl, "Chọn: ");
	rl.close();

	const trimmed = input.trim();
	if (trimmed === "0" || trimmed === "") {
		console.log("Đã thoát.");
		process.exit(0);
	}

	const selected =
		trimmed === "a"
			? definitions
			: trimmed
					.split(",")
					.map((s) => Number.parseInt(s.trim(), 10) - 1)
					.filter((i) => i >= 0 && i < definitions.length)
					.map((i) => definitions[i]!);

	if (selected.length === 0) {
		console.log("Bạn chưa chọn bất kỳ nhà cung cấp nào.");
		process.exit(0);
	}

	console.log(`\nSẽ phân quyền: ${selected.map((p) => p.name).join(", ")}\n`);

	for (const provider of selected) {
		console.log(`\n━━━ ${provider.name} ━━━`);
		try {
			const credentials = await provider.loginFn({
				onProgress: (msg) => console.log(`  > ${msg}`),
				openUrl: async (url) => {
					console.log(`  > Đang mở: ${url}`);
					return true;
				},
			});

			if (credentials && typeof credentials === "object") {
				saveCredentials(provider.id, credentials);
				console.log(`  ✓ ${provider.name} đã phân quyền thành công!`);
			}
		} catch (error) {
			console.error(
				`  ✗ ${provider.name} phân quyền thất bại:`,
				error instanceof Error ? error.message : error,
			);
		}
	}

	console.log("\nPhân quyền hoàn tất!");
	console.log("Khởi động gateway: free-ai-gateway start");
	console.log(
		"\nLưu ý: nếu quá trình không thoát tự động, nhấn Ctrl+C — credentials đã được lưu.\n",
	);
	process.exit(0);
}

main().catch(console.error);
