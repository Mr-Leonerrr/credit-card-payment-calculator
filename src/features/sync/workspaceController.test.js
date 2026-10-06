import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceController } from "./workspaceController.js";
import { emptyWorkspace, serializeWorkspace } from "./workspacePayload.js";
import { accountCacheKey } from "./accountCache.js";
import { STORAGE_KEY } from "../cards/services/storage.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

function fixture({
  userId = "a",
  remote = undefined,
  repository = {},
  online = true,
  isCurrent,
} = {}) {
  const values = new Map();
  const timers = new Map();
  let timerId = 0;
  const calls = [];
  let row =
    remote === undefined
      ? {
          user_id: userId,
          schema_version: 1,
          version: 1,
          payload: serializeWorkspace(emptyWorkspace()),
        }
      : remote;
  const service = {
    async load(id) {
      calls.push(["load", id]);
      return row;
    },
    async save(id, payload, expectedVersion, guard) {
      calls.push(["save", id, payload, expectedVersion]);
      assert.equal(guard(), true);
      if ((row?.version ?? 0) !== expectedVersion)
        throw new Error("SYNC_CONFLICT");
      row = {
        user_id: id,
        schema_version: 1,
        version: expectedVersion + 1,
        payload,
      };
      return row;
    },
    ...repository,
  };
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const controller = createWorkspaceController({
    userId,
    repository: service,
    storage,
    isCurrent,
    isOnline: () => online,
    setTimer: (callback) => {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimer: (identifier) => timers.delete(identifier),
  });
  return {
    controller,
    calls,
    values,
    storage,
    timers,
    setOnline: (value) => {
      online = value;
    },
    setRemote: (value) => {
      row = value;
    },
    getRemote: () => row,
  };
}

const rename = (controller, name) =>
  controller.setWorkspace((workspace) => ({
    ...workspace,
    cards: workspace.cards.map((card) => ({ ...card, name })),
  }));

const setRate = (controller, rate) =>
  controller.setWorkspace((workspace) => ({
    ...workspace,
    cards: workspace.cards.map((card) => ({ ...card, rate })),
  }));

const importMarkerKey = (userId) =>
  `calculation-workspace-imported-v1:${encodeURIComponent(userId)}`;

test("first fetch blocks writes; no row requires explicit choice and never imports automatically", async () => {
  const pending = deferred();
  const setup = fixture({
    remote: null,
    repository: { load: () => pending.promise },
  });
  const guest = emptyWorkspace();
  guest.cards[0].name = "Guest";
  setup.values.set(STORAGE_KEY, JSON.stringify(guest));
  const loading = setup.controller.start();
  assert.equal(rename(setup.controller, "Premature"), false);
  assert.notEqual(
    setup.controller.getSnapshot().workspace.cards[0].name,
    "Guest",
  );
  pending.resolve(null);
  await loading;
  assert.equal(setup.controller.getSnapshot().status, "needs-choice");
  assert.equal(setup.controller.getSnapshot().importAvailable, true);
  assert.equal(setup.calls.length, 0);
  assert.equal(await setup.controller.importLocal(false), true);
  assert.equal(setup.calls[0][0], "save");
  assert.equal(setup.calls[0][3], 0);
  assert.equal(setup.controller.getSnapshot().status, "synced");
  assert.notEqual(setup.getRemote().payload.cards[0].name, "Guest");
});

test("local preferences never enqueue a save; financial changes debounce into one snapshot", async () => {
  const setup = fixture();
  await setup.controller.start();
  setup.controller.setWorkspace((workspace) => ({
    ...workspace,
    theme: "dark",
    horizon: 12,
  }));
  assert.equal(setup.timers.size, 0);
  assert.equal(setup.controller.getSnapshot().dirty, false);
  rename(setup.controller, "One");
  rename(setup.controller, "Two");
  assert.equal(setup.timers.size, 1);
  await setup.controller.flush();
  assert.equal(
    setup.calls.filter(([operation]) => operation === "save").length,
    1,
  );
  assert.equal(setup.getRemote().payload.cards[0].name, "Two");
  assert.equal(setup.controller.getSnapshot().workspace.theme, "dark");
});

test("offline and conflict permit device preferences but never financial changes", async () => {
  const setup = fixture();
  await setup.controller.start();
  setup.setOnline(false);
  setup.controller.offline();
  assert.equal(
    setup.controller.setWorkspace((workspace) => ({
      ...workspace,
      horizon: 12,
      theme: "dark",
    })),
    true,
  );
  assert.equal(rename(setup.controller, "Offline edit"), false);
  assert.equal(setup.controller.getSnapshot().workspace.horizon, 12);
  assert.equal(
    setup.calls.filter(([operation]) => operation === "save").length,
    0,
  );
  setup.controller.stop();
});

test("serialized saves retain newer edits and cache only acknowledged payloads", async () => {
  const first = deferred();
  let count = 0;
  const saves = [];
  const setup = fixture({
    repository: {
      async save(id, payload, expectedVersion) {
        saves.push({ payload, expectedVersion });
        if (++count === 1) return first.promise;
        return {
          user_id: id,
          schema_version: 1,
          version: expectedVersion + 1,
          payload,
        };
      },
    },
  });
  await setup.controller.start();
  rename(setup.controller, "First");
  const saving = setup.controller.flush();
  await Promise.resolve();
  rename(setup.controller, "Second");
  const duplicate = setup.controller.flush();
  assert.equal(saves.length, 1);
  assert.notEqual(
    JSON.parse(setup.values.get(accountCacheKey("a"))).payload.cards[0].name,
    "First",
  );
  first.resolve({
    user_id: "a",
    schema_version: 1,
    version: 2,
    payload: saves[0].payload,
  });
  await Promise.all([saving, duplicate]);
  assert.equal(setup.controller.getSnapshot().dirty, true);
  assert.equal(
    setup.controller.getSnapshot().workspace.cards[0].name,
    "Second",
  );
  assert.equal(
    JSON.parse(setup.values.get(accountCacheKey("a"))).payload.cards[0].name,
    "First",
  );
  await setup.controller.flush();
  assert.equal(saves[1].expectedVersion, 2);
  assert.equal(setup.controller.getSnapshot().dirty, false);
});

test("CAS conflict freezes edits, retains draft and requires explicit reload to discard", async () => {
  const setup = fixture();
  await setup.controller.start();
  rename(setup.controller, "Mine");
  const remote = structuredClone(setup.getRemote());
  remote.version += 1;
  remote.payload.cards[0].name = "Theirs";
  setup.setRemote(remote);
  assert.equal(await setup.controller.flush(), false);
  assert.equal(setup.controller.getSnapshot().status, "conflict");
  assert.equal(setup.controller.getSnapshot().dirty, true);
  assert.equal(setup.controller.getSnapshot().workspace.cards[0].name, "Mine");
  assert.equal(rename(setup.controller, "Overwrite"), false);
  await setup.controller.refresh();
  assert.equal(setup.controller.getSnapshot().workspace.cards[0].name, "Mine");
  await setup.controller.reload();
  assert.equal(
    setup.controller.getSnapshot().workspace.cards[0].name,
    "Theirs",
  );
  assert.equal(setup.controller.getSnapshot().dirty, false);
});

test("invalid partial edit stays pending and editable without sending or caching it", async () => {
  const setup = fixture();
  await setup.controller.start();
  const confirmed = setup.values.get(accountCacheKey("a"));
  setup.controller.setWorkspace((workspace) => ({
    ...workspace,
    cards: workspace.cards.map((card) => ({ ...card, rate: "2." })),
  }));
  assert.equal(setup.controller.getSnapshot().status, "synced");
  assert.equal(setup.controller.getSnapshot().error, "INVALID_DRAFT");
  assert.equal(setup.controller.getSnapshot().dirty, true);
  assert.equal(setup.controller.getSnapshot().canEdit, true);
  assert.equal(setup.timers.size, 0);
  await setup.controller.flush();
  assert.equal(setup.controller.getSnapshot().canEdit, true);
  assert.equal(
    setup.calls.filter(([operation]) => operation === "save").length,
    0,
  );
  assert.equal(setup.values.get(accountCacheKey("a")), confirmed);
  assert.equal(
    setup.controller.setWorkspace((workspace) => ({
      ...workspace,
      cards: workspace.cards.map((card) => ({ ...card, rate: "2.5" })),
    })),
    true,
  );
  assert.equal(setup.controller.getSnapshot().error, "");
  assert.equal(setup.timers.size, 1);
  await setup.controller.flush();
  const saves = setup.calls.filter(([operation]) => operation === "save");
  assert.equal(saves.length, 1);
  assert.equal(saves[0][2].cards[0].rate, "2.5");
  assert.equal(setup.controller.getSnapshot().dirty, false);
});

test("correcting an invalid draft back to the confirmed payload clears dirty without saving", async () => {
  const setup = fixture();
  await setup.controller.start();
  const rate = setup.controller.getSnapshot().workspace.cards[0].rate;
  rename(setup.controller, "Pending");
  assert.equal(setup.timers.size, 1);
  assert.equal(setRate(setup.controller, "2."), true);
  assert.equal(setup.timers.size, 0);
  const confirmed = JSON.parse(setup.values.get(accountCacheKey("a"))).payload;
  setup.controller.setWorkspace((workspace) => ({
    ...workspace,
    cards: confirmed.cards,
  }));
  assert.equal(setup.controller.getSnapshot().workspace.cards[0].rate, rate);
  assert.equal(setup.controller.getSnapshot().dirty, false);
  assert.equal(setup.controller.getSnapshot().error, "");
  assert.equal(setup.timers.size, 0);
  assert.equal(await setup.controller.flush(), false);
});

test("save acknowledgement retains a newer invalid draft and advances the confirmed version", async () => {
  const pending = deferred();
  const saves = [];
  const setup = fixture({
    repository: {
      save: async (id, payload, expectedVersion) => {
        saves.push({ payload, expectedVersion });
        if (saves.length === 1) return pending.promise;
        return {
          user_id: id,
          schema_version: 1,
          version: expectedVersion + 1,
          payload,
        };
      },
    },
  });
  await setup.controller.start();
  rename(setup.controller, "Confirmed name");
  const saving = setup.controller.flush();
  await Promise.resolve();
  setRate(setup.controller, "2.");
  pending.resolve({
    user_id: "a",
    schema_version: 1,
    version: 2,
    payload: saves[0].payload,
  });
  assert.equal(await saving, true);
  assert.equal(setup.controller.getSnapshot().workspace.cards[0].rate, "2.");
  assert.equal(setup.controller.getSnapshot().status, "synced");
  assert.equal(setup.controller.getSnapshot().canEdit, true);
  assert.equal(setup.controller.getSnapshot().dirty, true);
  assert.equal(setup.controller.getSnapshot().error, "INVALID_DRAFT");
  assert.equal(setup.timers.size, 0);
  const cached = JSON.parse(setup.values.get(accountCacheKey("a")));
  assert.equal(cached.version, 2);
  assert.equal(cached.payload.cards[0].name, "Confirmed name");
  assert.notEqual(cached.payload.cards[0].rate, "2.");
  await setup.controller.flush();
  assert.equal(saves.length, 1);
  setRate(setup.controller, "2.5");
  await setup.controller.flush();
  assert.equal(saves[1].expectedVersion, 2);
  assert.equal(saves[1].payload.cards[0].rate, "2.5");
  assert.equal(setup.controller.getSnapshot().dirty, false);
});

test("refresh and stop/start preserve an editable invalid draft without a save timer", async () => {
  const setup = fixture();
  await setup.controller.start();
  setRate(setup.controller, "2.");
  setup.controller.stop();
  await setup.controller.start();
  await setup.controller.refresh();
  assert.equal(setup.controller.getSnapshot().workspace.cards[0].rate, "2.");
  assert.equal(setup.controller.getSnapshot().canEdit, true);
  assert.equal(setup.controller.getSnapshot().error, "INVALID_DRAFT");
  assert.equal(setup.timers.size, 0);
  assert.equal(
    setup.calls.filter(([operation]) => operation === "save").length,
    0,
  );
});

test("offline cache is readonly; reconnect checks version before resuming dirty draft", async () => {
  const setup = fixture();
  await setup.controller.start();
  rename(setup.controller, "Draft");
  setup.setOnline(false);
  setup.controller.offline();
  assert.equal(rename(setup.controller, "Offline"), false);
  assert.equal(await setup.controller.flush(), false);
  setup.setOnline(true);
  await setup.controller.refresh();
  assert.equal(setup.controller.getSnapshot().canEdit, true);
  assert.equal(setup.controller.getSnapshot().workspace.cards[0].name, "Draft");
  setup.setOnline(false);
  setup.controller.offline();
  const remote = structuredClone(setup.getRemote());
  remote.version += 1;
  setup.setRemote(remote);
  setup.setOnline(true);
  await setup.controller.refresh();
  assert.equal(setup.controller.getSnapshot().status, "conflict");
  assert.equal(setup.controller.getSnapshot().workspace.cards[0].name, "Draft");
});

test("read and save failures block edits, retain confirmed cache and never auto-retry", async () => {
  const setup = fixture({
    repository: {
      save: async () => {
        throw new Error("Network failure");
      },
    },
  });
  await setup.controller.start();
  const confirmed = setup.values.get(accountCacheKey("a"));
  rename(setup.controller, "Unsaved");
  await setup.controller.flush();
  assert.equal(setup.controller.getSnapshot().status, "error");
  assert.equal(setup.timers.size, 0);
  assert.equal(setup.values.get(accountCacheKey("a")), confirmed);
  const failedRead = fixture({
    repository: {
      load: async () => {
        throw new Error("Read failure");
      },
    },
  });
  failedRead.values.set(accountCacheKey("a"), confirmed);
  await failedRead.controller.start();
  assert.equal(failedRead.controller.getSnapshot().status, "error");
  assert.equal(failedRead.controller.getSnapshot().canEdit, false);
  assert.deepEqual(
    failedRead.controller.getSnapshot().workspace.cards,
    JSON.parse(confirmed).payload.cards,
  );
});

test("identity and generation guards ignore old loads, old saves and retained setters", async () => {
  const pending = deferred();
  let current = true;
  const setup = fixture({
    isCurrent: () => current,
    repository: { load: () => pending.promise },
  });
  const loading = setup.controller.start();
  current = false;
  pending.resolve(setup.getRemote());
  await loading;
  assert.equal(setup.controller.getSnapshot().status, "loading");
  assert.equal(rename(setup.controller, "Leaked"), false);
  const save = deferred();
  const savingSetup = fixture({ repository: { save: () => save.promise } });
  await savingSetup.controller.start();
  rename(savingSetup.controller, "Old user");
  const saving = savingSetup.controller.flush();
  await Promise.resolve();
  savingSetup.controller.stop();
  save.resolve({ ...savingSetup.getRemote(), version: 2 });
  await saving;
  assert.equal(
    JSON.parse(savingSetup.values.get(accountCacheKey("a"))).version,
    1,
  );
  const next = fixture({ userId: "b", online: false });
  await next.controller.start();
  assert.equal(next.controller.getSnapshot().status, "offline");
  assert.notEqual(
    next.controller.getSnapshot().workspace.cards[0].name,
    "Old user",
  );
});

test("StrictMode start/stop/start ignores stale reads and never duplicates a save", async () => {
  const old = deferred();
  let reads = 0;
  const setup = fixture({
    repository: {
      load: () =>
        ++reads === 1 ? old.promise : Promise.resolve(setup.getRemote()),
    },
  });
  const firstStart = setup.controller.start();
  await Promise.resolve();
  setup.controller.stop();
  await setup.controller.start();
  old.resolve(null);
  await firstStart;
  assert.equal(setup.controller.getSnapshot().status, "synced");
  rename(setup.controller, "Once");
  await Promise.all([setup.controller.flush(), setup.controller.flush()]);
  assert.equal(
    setup.calls.filter(([operation]) => operation === "save").length,
    1,
  );
});

test("explicit import appends regenerated scenarios and preserves guest storage", async () => {
  const setup = fixture();
  const guest = emptyWorkspace();
  guest.cards[0].name = "Local scenario";
  const original = JSON.stringify({ ...guest, theme: "dark", horizon: 12 });
  setup.values.set(STORAGE_KEY, original);
  await setup.controller.start();
  assert.equal(await setup.controller.importLocal(true), true);
  const workspace = setup.controller.getSnapshot().workspace;
  assert.equal(workspace.cards.length, 2);
  assert.equal(workspace.cards[1].name, "Local scenario");
  assert.notEqual(workspace.cards[1].id, guest.cards[0].id);
  assert.equal(workspace.theme, "light");
  assert.equal(setup.values.get(STORAGE_KEY), original);
});

test("successful import markers persist per account and contain only guest checksums", async () => {
  const setup = fixture();
  const guest = emptyWorkspace();
  guest.cards[0].name = "Private guest scenario";
  const original = JSON.stringify(guest);
  setup.values.set(STORAGE_KEY, original);
  await setup.controller.start();
  assert.equal(await setup.controller.importLocal(), true);
  assert.equal(setup.controller.getSnapshot().importAvailable, false);
  assert.equal(await setup.controller.importLocal(), false);
  assert.equal(setup.controller.getSnapshot().workspace.cards.length, 2);
  assert.equal(
    setup.calls.filter(([operation]) => operation === "save").length,
    1,
  );
  const marker = JSON.parse(setup.values.get(importMarkerKey("a")));
  assert.equal(marker.length, 1);
  assert.match(marker[0], /^[a-f0-9]{8}$/);
  setup.controller.stop();
  const restarted = createWorkspaceController({
    userId: "a",
    storage: setup.storage,
    repository: {
      load: async () => setup.getRemote(),
      save: async () => assert.fail("Repeated import saved"),
    },
  });
  await restarted.start();
  assert.equal(restarted.getSnapshot().importAvailable, false);
  assert.equal(await restarted.importLocal(), false);
  restarted.stop();
  const other = fixture({ userId: "b" });
  for (const [key, value] of setup.values) other.values.set(key, value);
  await other.controller.start();
  assert.equal(other.controller.getSnapshot().importAvailable, true);
  assert.equal(await other.controller.importLocal(), true);
  assert.ok(other.values.has(importMarkerKey("b")));
  assert.equal(setup.values.get(STORAGE_KEY), original);
  guest.cards[0].name = "Changed guest";
  setup.values.set(STORAGE_KEY, JSON.stringify(guest));
  await setup.controller.start();
  assert.equal(setup.controller.getSnapshot().importAvailable, true);
  assert.equal(setup.controller.getSnapshot().workspace.cards.length, 2);
  assert.equal(await setup.controller.importLocal(), true);
  assert.equal(setup.controller.getSnapshot().workspace.cards.length, 3);
  setup.values.set(STORAGE_KEY, original);
  await setup.controller.refresh();
  assert.equal(setup.controller.getSnapshot().importAvailable, false);
  assert.equal(await setup.controller.importLocal(), false);
});

test("import marker is written only after acknowledgement and concurrent imports cannot duplicate", async () => {
  const pending = deferred();
  let payload;
  const setup = fixture({
    repository: {
      save: async (id, snapshot) => {
        payload = snapshot;
        return pending.promise;
      },
    },
  });
  const guest = emptyWorkspace();
  guest.cards[0].name = "Guest";
  setup.values.set(STORAGE_KEY, JSON.stringify(guest));
  await setup.controller.start();
  const importing = setup.controller.importLocal();
  await Promise.resolve();
  assert.equal(setup.values.has(importMarkerKey("a")), false);
  assert.equal(await setup.controller.importLocal(), false);
  assert.equal(setup.controller.getSnapshot().workspace.cards.length, 2);
  pending.resolve({ user_id: "a", schema_version: 1, version: 2, payload });
  assert.equal(await importing, true);
  assert.equal(setup.values.has(importMarkerKey("a")), true);
});

test("failed and stale imports never write a successful marker", async () => {
  for (const stale of [false, "stop", "restart", "account"]) {
    const pending = deferred();
    let current = true;
    const setup = fixture({
      isCurrent: () => current,
      repository: { save: () => pending.promise },
    });
    const guest = emptyWorkspace();
    guest.cards[0].name = "Guest";
    setup.values.set(STORAGE_KEY, JSON.stringify(guest));
    await setup.controller.start();
    const importing = setup.controller.importLocal();
    await Promise.resolve();
    let restarting;
    if (stale === "account") current = false;
    if (stale === "stop" || stale === "restart") setup.controller.stop();
    if (stale === "restart") restarting = setup.controller.start();
    if (stale) pending.resolve({ ...setup.getRemote(), version: 2 });
    else pending.reject(new Error("Network failure"));
    assert.equal(await importing, false);
    if (restarting) await restarting;
    assert.equal(setup.values.has(importMarkerKey("a")), false);
    assert.equal(setup.values.get(STORAGE_KEY), JSON.stringify(guest));
    assert.equal(JSON.parse(setup.values.get(accountCacheKey("a"))).version, 1);
    setup.controller.stop();
  }
});

test("confirmed remote deletion clears account cache and requires a new explicit choice", async () => {
  const setup = fixture();
  await setup.controller.start();
  assert.ok(setup.values.has(accountCacheKey("a")));
  setup.setRemote(null);
  await setup.controller.refresh();
  assert.equal(setup.controller.getSnapshot().status, "needs-choice");
  assert.equal(setup.controller.getSnapshot().canEdit, false);
  assert.equal(setup.values.has(accountCacheKey("a")), false);
  assert.equal(
    setup.calls.filter(([operation]) => operation === "save").length,
    0,
  );
});

test("dirty remote deletion conflicts instead of recreating the row", async () => {
  const setup = fixture();
  await setup.controller.start();
  rename(setup.controller, "Keep in memory");
  setup.setRemote(null);
  await setup.controller.refresh();
  assert.equal(setup.controller.getSnapshot().status, "conflict");
  assert.equal(
    setup.controller.getSnapshot().workspace.cards[0].name,
    "Keep in memory",
  );
  assert.equal(
    setup.calls.filter(([operation]) => operation === "save").length,
    0,
  );
});

test("old scheduled save cannot dispatch after scope changes before the microtask", async () => {
  let current = true;
  const setup = fixture({ isCurrent: () => current });
  await setup.controller.start();
  rename(setup.controller, "Old scope");
  const pending = setup.controller.flush();
  current = false;
  await pending;
  assert.equal(
    setup.calls.filter(([operation]) => operation === "save").length,
    0,
  );
});

test("focus refresh waits for in-flight save rather than conflicting with its own acknowledgement", async () => {
  const saving = deferred();
  let payload;
  const setup = fixture({
    repository: {
      save: async (id, snapshot) => {
        payload = snapshot;
        return saving.promise;
      },
    },
  });
  await setup.controller.start();
  rename(setup.controller, "First");
  const commit = setup.controller.flush();
  await Promise.resolve();
  rename(setup.controller, "Second");
  const refresh = setup.controller.refresh();
  assert.equal(setup.controller.getSnapshot().canEdit, false);
  const row = { user_id: "a", schema_version: 1, version: 2, payload };
  setup.setRemote(row);
  saving.resolve(row);
  await Promise.all([commit, refresh]);
  assert.equal(setup.controller.getSnapshot().status, "synced");
  assert.equal(
    setup.controller.getSnapshot().workspace.cards[0].name,
    "Second",
  );
  assert.equal(setup.controller.getSnapshot().dirty, true);
});

test("refresh waiting on a failed save cannot clear its freeze or auto-retry", async () => {
  const saving = deferred();
  const setup = fixture({ repository: { save: () => saving.promise } });
  await setup.controller.start();
  rename(setup.controller, "Unsaved draft");
  const commit = setup.controller.flush();
  await Promise.resolve();
  const refresh = setup.controller.refresh();
  saving.reject(new Error("Network failure"));
  await Promise.all([commit, refresh]);
  assert.equal(setup.controller.getSnapshot().status, "error");
  assert.equal(setup.controller.getSnapshot().dirty, true);
  assert.equal(
    setup.controller.getSnapshot().workspace.cards[0].name,
    "Unsaved draft",
  );
  assert.equal(setup.timers.size, 0);
  assert.equal(
    setup.calls.filter(([operation]) => operation === "load").length,
    1,
  );
});

test("explicit reload during a background read still performs a confirmed discard", async () => {
  const pending = deferred();
  let reads = 0;
  const setup = fixture({
    repository: {
      load: () =>
        ++reads === 2 ? pending.promise : Promise.resolve(setup.getRemote()),
    },
  });
  await setup.controller.start();
  rename(setup.controller, "Draft");
  const remote = structuredClone(setup.getRemote());
  remote.version += 1;
  remote.payload.cards[0].name = "Remote";
  setup.setRemote(remote);
  const refresh = setup.controller.refresh();
  const reload = setup.controller.reload();
  pending.resolve(remote);
  await Promise.all([refresh, reload]);
  assert.equal(reads, 3);
  assert.equal(setup.controller.getSnapshot().status, "synced");
  assert.equal(setup.controller.getSnapshot().dirty, false);
  assert.equal(
    setup.controller.getSnapshot().workspace.cards[0].name,
    "Remote",
  );
});
