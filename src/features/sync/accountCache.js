import { validateRow } from "./workspacePayload.js";

export function accountCacheKey(userId) {
  if (typeof userId !== "string" || !userId)
    throw new Error("AUTHENTICATION_REQUIRED");
  return `calculation-workspace-confirmed-v1:${encodeURIComponent(userId)}`;
}

export function readAccountCache(userId, storage) {
  const saved = storage?.getItem(accountCacheKey(userId));
  return saved ? validateRow(JSON.parse(saved), userId) : null;
}

export function writeAccountCache(userId, row, storage) {
  validateRow(row, userId);
  storage?.setItem(
    accountCacheKey(userId),
    JSON.stringify({
      user_id: userId,
      schema_version: 1,
      version: row.version,
      payload: row.payload,
    }),
  );
}

export function clearAccountCache(userId, storage = globalThis.localStorage) {
  storage?.removeItem(accountCacheKey(userId));
}
