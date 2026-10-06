import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceController } from "./workspaceController.js";
import { emptyWorkspace, serializeWorkspace } from "./workspacePayload.js";

function setup() {
  let row = {
    user_id: "demo",
    schema_version: 1,
    version: 1,
    payload: serializeWorkspace(emptyWorkspace()),
  };
  let reads = () => Promise.resolve(row);
  let writes = 0;
  let failure = false;
  const controller = createWorkspaceController({
    userId: "demo",
    repository: {
      load: () => reads(),
      save: async (_id, payload, version) => {
        writes += 1;
        if (failure) throw new Error("Network failure");
        row = { ...row, payload, version: version + 1 };
        return row;
      },
    },
  });
  return {
    controller,
    writes: () => writes,
    fail: (value) => {
      failure = value;
    },
    read: (value) => {
      reads = value;
    },
  };
}
const edit = (controller, name) =>
  controller.setWorkspace((workspace) => ({
    ...workspace,
    cards: workspace.cards.map((card) => ({ ...card, name })),
  }));

test("background reads keep controls enabled and preserve edits made during the request", async () => {
  const state = setup();
  await state.controller.start();
  let resolve;
  state.read(
    () =>
      new Promise((accept) => {
        resolve = accept;
      }),
  );
  const reading = state.controller.refresh();
  await Promise.resolve();
  assert.equal(state.controller.getSnapshot().canEdit, true);
  assert.equal(edit(state.controller, "Draft during refresh"), true);
  resolve({
    user_id: "demo",
    schema_version: 1,
    version: 1,
    payload: serializeWorkspace(emptyWorkspace()),
  });
  await reading;
  assert.equal(
    state.controller.getSnapshot().workspace.cards[0].name,
    "Draft during refresh",
  );
  assert.equal(state.writes(), 0);
});

test("discard restores confirmed calculations and preferences without writing", async () => {
  const state = setup();
  await state.controller.start();
  edit(state.controller, "Unsaved");
  state.controller.setWorkspace((workspace) => ({
    ...workspace,
    theme: "dark",
  }));
  assert.equal(state.controller.discard(), true);
  assert.equal(state.controller.getSnapshot().dirty, false);
  assert.equal(
    state.controller.getSnapshot().workspace.cards[0].name,
    "Mi tarjeta",
  );
  assert.equal(state.controller.getSnapshot().workspace.theme, "dark");
  assert.equal(state.writes(), 0);
});

test("failed manual save retains draft and can retry explicitly", async () => {
  const state = setup();
  await state.controller.start();
  edit(state.controller, "Keep me");
  state.fail(true);
  assert.equal(await state.controller.flush(), false);
  assert.equal(state.controller.getSnapshot().dirty, true);
  assert.equal(state.controller.getSnapshot().canEdit, true);
  state.fail(false);
  assert.equal(await state.controller.flush(), true);
  assert.equal(state.controller.getSnapshot().dirty, false);
});

test("unchanged background refresh keeps the workspace object and status stable", async () => {
  const state = setup();
  await state.controller.start();
  const workspace = state.controller.getSnapshot().workspace;
  const statuses = [];
  state.controller.subscribe(() =>
    statuses.push(state.controller.getSnapshot().status),
  );
  await state.controller.refresh();
  assert.equal(state.controller.getSnapshot().workspace, workspace);
  assert.deepEqual(statuses, []);
});

test("discard is refused while an explicit save is in flight", async () => {
  let resolve;
  const controller = createWorkspaceController({
    userId: "demo",
    repository: {
      load: async () => ({
        user_id: "demo",
        schema_version: 1,
        version: 1,
        payload: serializeWorkspace(emptyWorkspace()),
      }),
      save: async (_id, payload) =>
        new Promise((accept) => {
          resolve = () =>
            accept({ user_id: "demo", schema_version: 1, version: 2, payload });
        }),
    },
  });
  await controller.start();
  edit(controller, "Sending");
  const saving = controller.flush();
  await Promise.resolve();
  assert.equal(controller.discard(), false);
  assert.equal(controller.getSnapshot().workspace.cards[0].name, "Sending");
  resolve();
  await saving;
  assert.equal(controller.getSnapshot().dirty, false);
});
