import {
  emptyWorkspace,
  serializeWorkspace,
  hydratePayload,
  validateRow,
  readGuestPayload,
  importLocalPayload,
} from "./workspacePayload.js";
import {
  clearAccountCache,
  readAccountCache,
  writeAccountCache,
} from "./accountCache.js";

const editable = (status) => ["synced", "saving", "error"].includes(status);
const messageOf = (error) => error?.message || "SYNC_FAILED";

export function createWorkspaceController({
  userId,
  repository,
  storage,
  isCurrent = () => true,
  isOnline = () => globalThis.navigator?.onLine !== false,
}) {
  let state = {
    workspace: emptyWorkspace(),
    status: userId ? "loading" : "signed-out",
    error: "",
    canEdit: false,
    importAvailable: false,
    dirty: false,
  };
  let active = false;
  let generation = 0;
  let version = null;
  let confirmedPayload = null;
  let savePromise = null;
  let readPromise = null;
  let importing = null;
  const importedFingerprints = new Set();
  const listeners = new Set();
  const current = (token = generation) =>
    active && Boolean(userId) && isCurrent() && token === generation;

  function publish(changes) {
    state = { ...state, ...changes };
    state.canEdit =
      current() && isOnline() && version !== null && editable(state.status);
    for (const listener of listeners) listener();
  }

  function fail(error) {
    const message = messageOf(error);
    publish({
      status: message.includes("SYNC_CONFLICT") ? "conflict" : "error",
      error: message,
    });
  }

  function guestAvailable() {
    try {
      const guest = readGuestPayload(storage);
      return Boolean(guest && !alreadyImported(fingerprint(guest)));
    } catch {
      return false;
    }
  }

  function importMarkerKey() {
    return `calculation-workspace-imported-v1:${encodeURIComponent(userId)}`;
  }

  function fingerprint(payload) {
    let checksum = 2166136261;
    const serialized = JSON.stringify(payload);
    for (const character of serialized) {
      checksum = Math.imul(checksum ^ character.codePointAt(0), 16777619);
    }
    return (checksum >>> 0).toString(16).padStart(8, "0");
  }

  function alreadyImported(value) {
    try {
      const saved = JSON.parse(storage?.getItem(importMarkerKey()) || "[]");
      if (Array.isArray(saved)) {
        for (const item of saved) {
          if (typeof item === "string" && /^[a-f0-9]{8}$/.test(item))
            importedFingerprints.add(item);
        }
      }
    } catch {}
    return importedFingerprints.has(value);
  }

  function markImported(value) {
    alreadyImported(value);
    importedFingerprints.add(value);
    try {
      storage?.setItem(
        importMarkerKey(),
        JSON.stringify([...importedFingerprints]),
      );
    } catch {}
  }

  function cache(row) {
    try {
      if (row) writeAccountCache(userId, row, storage);
      else clearAccountCache(userId, storage);
    } catch {}
  }

  async function flush() {
    if (savePromise) return savePromise;
    if (!current() || !state.canEdit || !state.dirty || version === null)
      return false;
    let payload;
    try {
      payload = serializeWorkspace(state.workspace);
    } catch {
      publish({ status: "synced", error: "INVALID_DRAFT", dirty: true });
      return false;
    }
    const token = generation;
    const expectedVersion = version;
    publish({ status: "saving", error: "" });
    const operation = Promise.resolve().then(async () => {
      if (!current(token) || !isOnline()) return false;
      try {
        const row = validateRow(
          await repository.save(userId, payload, expectedVersion, () =>
            current(token),
          ),
          userId,
        );
        if (!current(token)) return false;
        if (row.version !== expectedVersion + 1)
          throw new Error("INVALID_SERVER_VERSION");
        version = row.version;
        confirmedPayload = JSON.stringify(
          serializeWorkspace(hydratePayload(row.payload)),
        );
        cache(row);
        let dirty = true;
        let error = "";
        try {
          dirty =
            JSON.stringify(serializeWorkspace(state.workspace)) !==
            confirmedPayload;
        } catch {
          error = "INVALID_DRAFT";
        }
        const workspace = dirty
          ? state.workspace
          : hydratePayload(row.payload, state.workspace);
        publish({
          workspace,
          dirty,
          error,
          status: editable(state.status)
            ? isOnline()
              ? "synced"
              : "offline"
            : state.status,
        });
        return true;
      } catch (error) {
        if (current(token)) fail(error);
        return false;
      }
    });
    savePromise = operation;
    try {
      return await operation;
    } finally {
      if (savePromise === operation) savePromise = null;
    }
  }

  async function fetchCloud({ discard = false, background = false } = {}) {
    if (!current()) return false;
    if (readPromise) return readPromise;
    const token = generation;
    if (!background)
      publish({ status: isOnline() ? "loading" : "offline", error: "" });
    const operation = Promise.resolve().then(async () => {
      if (savePromise) await savePromise;
      if (!current(token) || !isOnline()) return false;
      if (
        !discard &&
        ["error", "conflict"].includes(state.status)
      )
        return false;
      try {
        const result = await repository.load(userId);
        if (!current(token)) return false;
        if (
          !discard &&
          ["error", "conflict"].includes(state.status)
        )
          return false;
        const row = result === null ? null : validateRow(result, userId);
        const remoteVersion = row?.version ?? 0;
        if (
          background &&
          !discard &&
          !state.dirty &&
          remoteVersion === version &&
          ["synced", "remote-update"].includes(state.status)
        )
          return true;
        if (
          background &&
          !discard &&
          !state.dirty &&
          version !== null &&
          remoteVersion !== version
        ) {
          publish({
            status: "remote-update",
            error: "",
            importAvailable: guestAvailable(),
          });
          return true;
        }
        if (state.dirty && !discard) {
          if (remoteVersion !== version) {
            fail(new Error("SYNC_CONFLICT"));
            return false;
          }
          let error = "";
          try {
            serializeWorkspace(state.workspace);
          } catch {
            error = "INVALID_DRAFT";
          }
          publish({
            status: isOnline() ? "synced" : "offline",
            error,
            importAvailable: guestAvailable(),
          });
          return true;
        }
        version = remoteVersion;
        confirmedPayload = row
          ? JSON.stringify(serializeWorkspace(hydratePayload(row.payload)))
          : null;
        cache(row);
        publish({
          workspace: row
            ? hydratePayload(row.payload, state.workspace)
            : emptyWorkspace(),
          status: isOnline() ? (row ? "synced" : "needs-choice") : "offline",
          error: "",
          dirty: false,
          importAvailable: guestAvailable(),
        });
        return true;
      } catch (error) {
        if (current(token)) fail(error);
        return false;
      }
    });
    readPromise = operation;
    try {
      return await operation;
    } finally {
      if (readPromise === operation) readPromise = null;
    }
  }

  const controller = {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (active) return readPromise ?? Promise.resolve(false);
      active = true;
      generation += 1;
      if (!userId || !isCurrent()) return Promise.resolve(false);
      if (!state.dirty && version === null) {
        try {
          const row = readAccountCache(userId, storage);
          if (row)
            publish({
              workspace: hydratePayload(row.payload),
              importAvailable: guestAvailable(),
            });
        } catch {}
      }
      readPromise = null;
      return fetchCloud();
    },
    stop() {
      active = false;
      generation += 1;
    },
    setWorkspace(update) {
      if (!current()) return false;
      const next =
        typeof update === "function"
          ? update(structuredClone(state.workspace))
          : update;
      if (
        JSON.stringify(state.workspace.cards) === JSON.stringify(next.cards)
      ) {
        publish({
          workspace: {
            ...state.workspace,
            theme: next.theme,
            horizon: next.horizon,
            activeId: next.activeId,
          },
        });
        return true;
      }
      if (!state.canEdit || !isOnline()) return false;
      try {
        const after = JSON.stringify(serializeWorkspace(next));
        publish({
          workspace: next,
          dirty: after !== confirmedPayload,
          error: "",
        });
        return true;
      } catch {
        publish({
          workspace: next,
          dirty: true,
          status: "synced",
          error: "INVALID_DRAFT",
        });
        return true;
      }
    },
    async reload() {
      const token = generation;
      if (!current(token)) return false;
      if (readPromise) await readPromise;
      if (!current(token)) return false;
      return fetchCloud({ discard: true });
    },
    discard() {
      if (!current() || savePromise || version === null) return false;
      publish({
        workspace: confirmedPayload
          ? hydratePayload(JSON.parse(confirmedPayload), state.workspace)
          : emptyWorkspace(),
        dirty: false,
        error: "",
        status: isOnline()
          ? state.status === "conflict"
            ? "conflict"
            : version === 0
              ? "needs-choice"
              : "synced"
          : "offline",
      });
      return true;
    },
    async importLocal(includeGuest = true) {
      const token = generation;
      if (
        !current(token) ||
        !isOnline() ||
        importing ||
        state.dirty ||
        !(state.canEdit || state.status === "needs-choice")
      )
        return false;
      if (!includeGuest && state.status !== "needs-choice") return false;
      const operation = {};
      importing = operation;
      try {
        let workspace = state.workspace;
        let guestFingerprint = null;
        if (includeGuest) {
          const guest = readGuestPayload(storage);
          if (!guest) throw new Error("NO_IMPORTABLE_LOCAL_DATA");
          guestFingerprint = fingerprint(guest);
          if (alreadyImported(guestFingerprint)) {
            publish({ importAvailable: false });
            return false;
          }
          workspace = importLocalPayload(workspace, guest);
        }
        publish({
          workspace,
          status: "synced",
          dirty: true,
          error: "",
          importAvailable: guestAvailable(),
        });
        while (current(token) && state.canEdit && state.dirty) {
          if (!(await flush())) return false;
        }
        if (!current(token) || state.dirty) return false;
        if (guestFingerprint) {
          markImported(guestFingerprint);
          publish({ importAvailable: guestAvailable() });
        }
        return true;
      } catch (error) {
        if (current(token)) fail(error);
        return false;
      } finally {
        if (importing === operation) importing = null;
      }
    },
    refresh() {
      if (!current() || state.status === "error" || state.status === "conflict")
        return Promise.resolve(false);
      return fetchCloud({ background: version !== null });
    },
    offline() {
      if (!current()) return;
      publish({
        status: ["error", "conflict", "remote-update"].includes(state.status)
          ? state.status
          : "offline",
      });
    },
    flush,
  };
  return controller;
}
