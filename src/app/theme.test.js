import test from "node:test";
import assert from "node:assert/strict";
import { readTheme, saveTheme, THEME_STORAGE_KEY } from "./theme.js";

test("theme survives reload independently of workspace defaults", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  saveTheme("dark", storage);
  assert.equal(readTheme("light", storage), "dark");
  saveTheme("light", storage);
  assert.equal(readTheme("dark", storage), "light");
  assert.deepEqual([...values.keys()], [THEME_STORAGE_KEY]);
});

test("legacy theme is used when no valid preference exists", () => {
  assert.equal(readTheme("dark", { getItem: () => null }), "dark");
  assert.equal(readTheme("dark", { getItem: () => "invalid" }), "dark");
  assert.equal(readTheme(undefined, { getItem: () => null }), "light");
});

test("unavailable storage does not prevent theme changes", () => {
  const storage = {
    getItem() { throw new Error("Blocked"); },
    setItem() { throw new Error("Blocked"); },
  };
  assert.equal(readTheme("dark", storage), "dark");
  assert.doesNotThrow(() => saveTheme("dark", storage));
});
