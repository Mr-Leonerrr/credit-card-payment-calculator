import test from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY } from "../cards/services/storage.js";
import { blankPurchase } from "../purchases/model/purchase.js";
import {
  emptyWorkspace,
  serializeWorkspace,
  hydratePayload,
  readGuestPayload,
  importLocalPayload,
  validateRow,
} from "./workspacePayload.js";
import {
  accountCacheKey,
  writeAccountCache,
  readAccountCache,
  clearAccountCache,
} from "./accountCache.js";

test("financial round trip excludes all device state", () => {
  const workspace = {
    ...emptyWorkspace(),
    theme: "dark",
    horizon: 12,
    secret: "not exported",
  };
  workspace.cards[0].purchases.push({
    ...blankPurchase(),
    amount: "100",
    description: "Example",
  });
  const payload = serializeWorkspace(workspace);
  assert.deepEqual(Object.keys(payload), ["cards"]);
  assert.deepEqual(hydratePayload(payload, workspace), {
    cards: workspace.cards,
    activeId: workspace.activeId,
    theme: "dark",
    horizon: 12,
  });
  payload.cards[0].name = "Changed";
  assert.notEqual(workspace.cards[0].name, "Changed");
});

test("DTO rejects unknown sensitive fields, missing keys and incomplete financial values", () => {
  for (const changes of [
    { cvv: "123" },
    { number: "1234" },
    { rate: "1." },
    { cutoffDay: "" },
    { referenceDate: "2026-02-30" },
    { previousBalance: null },
  ]) {
    const workspace = emptyWorkspace();
    Object.assign(workspace.cards[0], changes);
    assert.throws(
      () => serializeWorkspace(workspace),
      /INVALID_WORKSPACE_PAYLOAD/,
    );
  }
  const workspace = emptyWorkspace();
  delete workspace.cards[0].payments;
  assert.throws(() => serializeWorkspace(workspace));
  workspace.cards[0].payments = "";
  workspace.cards[0].purchases.push({
    ...blankPurchase(),
    amount: "10",
    expiry: "2028",
  });
  assert.throws(() => serializeWorkspace(workspace));
});

test("statement snapshots survive hydration without normalization filtering", () => {
  const workspace = emptyWorkspace();
  workspace.cards[0].purchases.push({
    ...blankPurchase(),
    entryMode: "statement",
    statementBalance: "100",
    statementNextDate: "2026-10-20",
    statementRemaining: "5",
  });
  assert.deepEqual(
    hydratePayload(serializeWorkspace(workspace)).cards,
    workspace.cards,
  );
});

test("statement quota breakdown survives sync validation and rejects incomplete recargos", () => {
  const workspace = emptyWorkspace();
  workspace.cards[0].purchases.push({
    ...blankPurchase(),
    entryMode: "statement",
    statementBalance: "800003",
    statementRemaining: "4",
    statementNextDate: "2026-10-20",
    statementPayment: "240000",
    statementIncludesExtras: true,
    statementExtraAmount: "5000",
  });
  assert.deepEqual(
    hydratePayload(serializeWorkspace(workspace)).cards,
    workspace.cards,
  );
  const missingExtra = structuredClone(workspace);
  missingExtra.cards[0].purchases[0].statementExtraAmount = "";
  assert.throws(
    () => serializeWorkspace(missingExtra),
    /INVALID_WORKSPACE_PAYLOAD/,
  );
  const uncheckedExtra = structuredClone(workspace);
  uncheckedExtra.cards[0].purchases[0].statementIncludesExtras = false;
  assert.throws(
    () => serializeWorkspace(uncheckedExtra),
    /INVALID_WORKSPACE_PAYLOAD/,
  );
});

test("older cloud snapshots gain empty quota-extra defaults without losing legacy capital", () => {
  const legacy = emptyWorkspace();
  legacy.cards[0].purchases.push({
    ...blankPurchase(),
    entryMode: "statement",
    statementBalance: "800003",
    statementRemaining: "4",
    statementCapital: "200001",
    statementNextDate: "2026-10-20",
  });
  const row = validateRow(
    {
      user_id: "owner",
      schema_version: 1,
      version: 3,
      payload: JSON.parse(
        JSON.stringify(serializeWorkspace(legacy), (key, value) =>
          [
            "statementPayment",
            "statementIncludesExtras",
            "statementExtraAmount",
          ].includes(key)
            ? undefined
            : value,
        ),
      ),
    },
    "owner",
  );
  const purchase = row.payload.cards[0].purchases[0];
  assert.equal(purchase.statementCapital, "200001");
  assert.equal(purchase.statementPayment, "");
  assert.equal(purchase.statementIncludesExtras, false);
  assert.equal(purchase.statementExtraAmount, "");
});

test("statement payment extras round-trip and reject unchecked or incomplete charges", () => {
  const workspace = emptyWorkspace();
  workspace.cards[0].purchases.push({
    ...blankPurchase(),
    entryMode: "statement",
    statementBalance: "800003",
    statementRemaining: "4",
    statementNextDate: "2026-10-20",
    statementPayment: "240000",
    statementIncludesExtras: true,
    statementExtraAmount: "5000",
  });
  assert.deepEqual(
    hydratePayload(serializeWorkspace(workspace)).cards,
    workspace.cards,
  );
  const unchecked = structuredClone(workspace);
  unchecked.cards[0].purchases[0].statementIncludesExtras = false;
  assert.throws(
    () => serializeWorkspace(unchecked),
    /INVALID_WORKSPACE_PAYLOAD/,
  );
  const incomplete = structuredClone(workspace);
  incomplete.cards[0].purchases[0].statementExtraAmount = "";
  assert.throws(
    () => serializeWorkspace(incomplete),
    /INVALID_WORKSPACE_PAYLOAD/,
  );
});

test("guest import projects cards only and regenerates every imported id", () => {
  const guest = emptyWorkspace();
  const values = new Map([[STORAGE_KEY, JSON.stringify(guest)]]);
  const storage = { getItem: (key) => values.get(key) ?? null };
  assert.equal(readGuestPayload(storage), null);
  guest.cards[0].purchases.push({ ...blankPurchase(), amount: "10" });
  values.set(
    STORAGE_KEY,
    JSON.stringify({ ...guest, theme: "dark", horizon: 12, token: "ignored" }),
  );
  const payload = readGuestPayload(storage);
  const target = emptyWorkspace();
  let identifier = 0;
  const result = importLocalPayload(
    target,
    payload,
    () => `import-${++identifier}`,
  );
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[1].id, "import-1");
  assert.equal(result.cards[1].purchases[0].id, "import-2");
  assert.equal(result.theme, "light");
  assert.equal(result.horizon, 6);
  assert.equal(guest.cards[0].id, payload.cards[0].id);
});

test("cache accepts confirmed rows only, isolates identities and preserves guest key", () => {
  const values = new Map([[STORAGE_KEY, "guest"]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const row = {
    user_id: "a",
    schema_version: 1,
    version: 1,
    payload: serializeWorkspace(emptyWorkspace()),
  };
  writeAccountCache("a", row, storage);
  assert.equal(readAccountCache("b", storage), null);
  assert.deepEqual(readAccountCache("a", storage), row);
  assert.throws(() => validateRow(row, "b"));
  assert.throws(() => validateRow({ ...row, version: 0 }, "a"));
  values.set(accountCacheKey("b"), JSON.stringify(row));
  assert.throws(() => readAccountCache("b", storage));
  clearAccountCache("a", storage);
  assert.equal(values.get(STORAGE_KEY), "guest");
});
