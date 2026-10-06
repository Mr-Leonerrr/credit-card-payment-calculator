import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceRepository } from "./repositoryAdapter.js";
import { emptyWorkspace, serializeWorkspace } from "./workspacePayload.js";

function clientFixture() {
  const calls = [];
  const row = {
    user_id: "a",
    schema_version: 1,
    version: 2,
    payload: serializeWorkspace(emptyWorkspace()),
  };
  let session = { user: { id: "a" } };
  let response = { data: row, error: null };
  const client = {
    from(table) {
      calls.push(["from", table]);
      return {
        select(columns) {
          calls.push(["select", columns]);
          return {
            eq(column, value) {
              calls.push(["eq", column, value]);
              return { maybeSingle: async () => response };
            },
          };
        },
      };
    },
    auth: { getSession: async () => ({ data: { session }, error: null }) },
    async rpc(name, args) {
      calls.push(["rpc", name, args]);
      return response;
    },
  };
  return {
    repository: createWorkspaceRepository(client),
    calls,
    row,
    setSession: (value) => {
      session = value;
    },
    setResponse: (value) => {
      response = value;
    },
  };
}

test("read scopes table query to account and validates ownership", async () => {
  const setup = clientFixture();
  assert.deepEqual(await setup.repository.load("a"), setup.row);
  assert.deepEqual(setup.calls, [
    ["from", "calculation_workspaces"],
    ["select", "user_id,payload,schema_version,version"],
    ["eq", "user_id", "a"],
  ]);
  await assert.rejects(setup.repository.load("b"), /INVALID_WORKSPACE_PAYLOAD/);
  setup.setResponse({ data: null, error: null });
  assert.equal(await setup.repository.load("a"), null);
});

test("save sends only RPC payload and expected version and returns canonical single row", async () => {
  const setup = clientFixture();
  assert.deepEqual(
    await setup.repository.save("a", setup.row.payload, 1),
    setup.row,
  );
  assert.deepEqual(setup.calls, [
    [
      "rpc",
      "save_calculation_workspace",
      {
        p_payload: setup.row.payload,
        p_expected_version: 1,
      },
    ],
  ]);
  setup.setResponse({ data: [setup.row], error: null });
  await assert.rejects(
    setup.repository.save("a", setup.row.payload, 1),
    /INVALID_WORKSPACE_PAYLOAD/,
  );
});

test("session changes and invalidated scopes cannot dispatch a save RPC", async () => {
  const setup = clientFixture();
  setup.setSession({ user: { id: "b" } });
  await assert.rejects(
    setup.repository.save("a", setup.row.payload, 1),
    /AUTHENTICATION_REQUIRED/,
  );
  setup.setSession({ user: { id: "a" } });
  await assert.rejects(
    setup.repository.save("a", setup.row.payload, 1, () => false),
    /AUTHENTICATION_REQUIRED/,
  );
  assert.equal(setup.calls.length, 0);
});

test("RPC conflict errors preserve the SYNC_CONFLICT message", async () => {
  const setup = clientFixture();
  const error = { code: "P0001", message: "SYNC_CONFLICT" };
  setup.setResponse({ data: null, error });
  await assert.rejects(
    setup.repository.save("a", setup.row.payload, 1),
    (actual) => actual === error,
  );
});
