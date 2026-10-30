import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getCredentials,
	getStorePath,
	loadAuthStore,
	saveCredentials,
} from "../src/providers/auth-store.ts";

const TEST_STORE_PATH = join(tmpdir(), `FAG-test-auth-${process.pid}.json`);

beforeAll(() => {
	process.env.FAG_STORE_PATH = TEST_STORE_PATH;
});

afterAll(() => {
	delete process.env.FAG_STORE_PATH;
	if (existsSync(TEST_STORE_PATH)) rmSync(TEST_STORE_PATH);
});

afterEach(() => {
	const storePath = getStorePath();
	if (existsSync(storePath)) rmSync(storePath);
});

describe("auth-store", () => {
	test("loadAuthStore trả về profiles rỗng khi không có file tồn tại", () => {
		const store = loadAuthStore();
		expect(store.profiles).toEqual({});
	});

	test("saveCredentials và getCredentials truyền thẳng", () => {
		saveCredentials("test-provider", { token: "abc123" });
		const creds = getCredentials<{ token: string }>("test-provider");
		expect(creds).toBeDefined();
		expect(creds?.token).toBe("abc123");
	});

	test("getCredentials trả về null cho provider không xác định", () => {
		expect(getCredentials("nonexistent")).toBeNull();
	});

	test("saveCredentials ghi đè provider đã tồn tại", () => {
		saveCredentials("test-provider", { v: 1 });
		saveCredentials("test-provider", { v: 2 });
		const creds = getCredentials<{ v: number }>("test-provider");
		expect(creds?.v).toBe(2);
	});

	test("nhiều providers", () => {
		saveCredentials("a", { key: "aaa" });
		saveCredentials("b", { key: "bbb" });
		expect(getCredentials<{ key: string }>("a")?.key).toBe("aaa");
		expect(getCredentials<{ key: string }>("b")?.key).toBe("bbb");
	});
});
