import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationUrls = [
  new URL("../migrations/001_calculation_workspaces.sql", import.meta.url),
  new URL("../migrations/002_statement_payment_breakdown.sql", import.meta.url),
  new URL("../migrations/003_previous_balance_charges.sql", import.meta.url),
  new URL("../migrations/004_previous_balance_interest_breakdown.sql", import.meta.url),
  new URL("../migrations/005_purchase_interest_free.sql", import.meta.url),
];
const ownerA = "00000000-0000-4000-8000-000000000001";
const ownerB = "00000000-0000-4000-8000-000000000002";
const payload = {
  cards: [{ id: "fictional-card", name: "Escenario ficticio", purchases: [] }],
};
let database;

async function asRole(role, userId, action) {
  assert.ok(["anon", "authenticated"].includes(role));
  await database.query(
    "select set_config('request.jwt.claim.sub', $1, false)",
    [userId ?? ""],
  );
  await database.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify(userId ? { sub: userId, role } : { role }),
  ]);
  await database.exec(`set role ${role}`);
  try {
    return await action();
  } finally {
    await database.exec("reset role");
    await database.query(
      "select set_config('request.jwt.claim.sub', '', false)",
    );
    await database.query(
      "select set_config('request.jwt.claims', '{}', false)",
    );
  }
}

async function save(expectedVersion, nextPayload = payload) {
  const result = await database.query(
    "select * from public.save_calculation_workspace($1::jsonb, $2::bigint)",
    [JSON.stringify(nextPayload), expectedVersion],
  );
  return result.rows[0];
}

async function rejectsSql(action, code, message) {
  await assert.rejects(action, (error) => {
    assert.equal(error.code, code);
    if (message) assert.match(error.message, message);
    return true;
  });
}

describe(
  "calculation workspace SQL security (isolated mocked auth)",
  { concurrency: false },
  () => {
    before(async () => {
      database = new PGlite();
      await database.exec(`
      create schema auth;
      create table auth.users (id uuid primary key);
      create role anon nologin;
      create role authenticated nologin;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
      for (const migrationUrl of migrationUrls) {
        await database.exec(await readFile(migrationUrl, "utf8"));
      }
    });

    beforeEach(async () => {
      await database.exec("truncate public.calculation_workspaces, auth.users");
      await database.query("insert into auth.users(id) values ($1), ($2)", [
        ownerA,
        ownerB,
      ]);
    });

    after(async () => {
      await database?.close();
    });

    it("enables owner-only SELECT RLS and restricts RPC signatures, search paths and grants", async () => {
      const table = await database.query(`
      select relrowsecurity from pg_class
      where oid = 'public.calculation_workspaces'::regclass
    `);
      assert.equal(table.rows[0].relrowsecurity, true);
      const functions = await database.query(`
      select proname, proargnames, prosecdef, proconfig, provolatile
      from pg_proc where oid in (
        'public.save_calculation_workspace(jsonb,bigint)'::regprocedure,
        'public.is_valid_calculation_workspace(jsonb)'::regprocedure
      ) order by proname
    `);
      assert.equal(functions.rows.length, 2);
      for (const fn of functions.rows) {
        assert.deepEqual(fn.proconfig, ['search_path=""']);
        assert.equal(
          fn.prosecdef,
          fn.proname !== "is_valid_calculation_workspace",
        );
        assert.deepEqual(
          fn.proargnames,
          fn.proname === "save_calculation_workspace"
            ? ["p_payload", "p_expected_version"]
            : ["p_payload"],
        );
        if (fn.proname === "is_valid_calculation_workspace")
          assert.equal(fn.provolatile, "i");
      }
      for (const role of ["anon", "authenticated"]) {
        const privileges = await database.query(
          `
        select has_table_privilege($1, 'public.calculation_workspaces', 'SELECT') as can_read,
          has_table_privilege($1, 'public.calculation_workspaces', 'INSERT') as can_insert,
          has_table_privilege($1, 'public.calculation_workspaces', 'UPDATE') as can_update,
          has_table_privilege($1, 'public.calculation_workspaces', 'DELETE') as can_delete,
          has_function_privilege($1, 'public.save_calculation_workspace(jsonb,bigint)', 'EXECUTE') as can_save,
          has_function_privilege($1, 'public.is_valid_calculation_workspace(jsonb)', 'EXECUTE') as can_validate
      `,
          [role],
        );
        assert.deepEqual(privileges.rows[0], {
          can_read: role === "authenticated",
          can_insert: false,
          can_update: false,
          can_delete: false,
          can_save: role === "authenticated",
          can_validate: false,
        });
      }
    });

    it("reruns all migrations without losing workspace rows or their revisions", async () => {
      await asRole("authenticated", ownerA, () => save(0));
      for (const migrationUrl of migrationUrls) {
        await database.exec(await readFile(migrationUrl, "utf8"));
      }
      const rows = await database.query(
        "select user_id, payload, version::integer from public.calculation_workspaces",
      );
      assert.deepEqual(rows.rows, [{ user_id: ownerA, payload, version: 1 }]);
      const privileges = await database.query(`
      select has_function_privilege('authenticated', 'public.save_calculation_workspace(jsonb,bigint)', 'EXECUTE') as can_save,
        has_table_privilege('authenticated', 'public.calculation_workspaces', 'INSERT') as can_insert
    `);
      assert.deepEqual(privileges.rows[0], {
        can_save: true,
        can_insert: false,
      });
    });

    it("derives RPC ownership from auth.uid and isolates A/B reads, including explicit foreign filters", async () => {
      const first = await asRole("authenticated", ownerA, () => save(0));
      const second = await asRole("authenticated", ownerB, () =>
        save(0, {
          cards: [{ name: "Otro escenario ficticio" }],
        }),
      );
      assert.equal(first.user_id, ownerA);
      assert.equal(second.user_id, ownerB);
      assert.equal(first.schema_version, 1);
      assert.equal(Number(first.version), 1);
      assert.ok(Number.isFinite(Date.parse(first.updated_at)));
      for (const [userId, otherId] of [
        [ownerA, ownerB],
        [ownerB, ownerA],
      ]) {
        await asRole("authenticated", userId, async () => {
          const visible = await database.query(
            "select user_id from public.calculation_workspaces",
          );
          assert.deepEqual(visible.rows, [{ user_id: userId }]);
          const foreign = await database.query(
            "select * from public.calculation_workspaces where user_id = $1",
            [otherId],
          );
          assert.deepEqual(foreign.rows, []);
          await rejectsSql(
            () =>
              database.query(
                "select public.save_calculation_workspace($1::jsonb, 1::bigint, $2::uuid)",
                [JSON.stringify(payload), otherId],
              ),
            "42883",
          );
        });
      }
      await asRole("authenticated", null, async () => {
        assert.deepEqual(
          (await database.query("select * from public.calculation_workspaces"))
            .rows,
          [],
        );
        await rejectsSql(() => save(0), "42501", /AUTHENTICATION_REQUIRED/);
      });
    });

    it("denies authenticated direct INSERT, UPDATE and DELETE for own and foreign rows", async () => {
      await asRole("authenticated", ownerA, () => save(0));
      await asRole("authenticated", ownerB, () => save(0));
      await asRole("authenticated", ownerA, async () => {
        for (const userId of [ownerA, ownerB]) {
          await rejectsSql(
            () =>
              database.query(
                "insert into public.calculation_workspaces(user_id, payload) values ($1, $2::jsonb)",
                [userId, JSON.stringify(payload)],
              ),
            "42501",
          );
          await rejectsSql(
            () =>
              database.query(
                "update public.calculation_workspaces set version = 99 where user_id = $1",
                [userId],
              ),
            "42501",
          );
          await rejectsSql(
            () =>
              database.query(
                "delete from public.calculation_workspaces where user_id = $1",
                [userId],
              ),
            "42501",
          );
        }
      });
      assert.deepEqual(
        (
          await database.query(
            "select version::integer from public.calculation_workspaces order by user_id",
          )
        ).rows,
        [{ version: 1 }, { version: 1 }],
      );
    });

    it("denies anon reads and the save RPC even with a forged owner setting", async () => {
      await asRole("authenticated", ownerA, () => save(0));
      for (const userId of [null, ownerA]) {
        await asRole("anon", userId, async () => {
          await rejectsSql(
            () => database.query("select * from public.calculation_workspaces"),
            "42501",
          );
          await rejectsSql(() => save(1), "42501", /permission denied/);
        });
      }
    });

    it("accepts the per-purchase 0% flag and rejects non-boolean values", async () => {
      const purchasePayload = (interestFree) => ({
        cards: [
          {
            id: "fictional-card",
            name: "Escenario ficticio",
            purchases: [
              {
                id: "fictional-purchase",
                description: "Compra promocional",
                amount: "900000",
                installments: "3",
                paidInstallments: "0",
                date: "2026-10-01",
                rateOverride: "",
                rateOverrideType: "monthly",
                entryMode: "purchase",
                processDate: "",
                statementBalance: "",
                statementRemaining: "3",
                statementCapital: "",
                statementNextDate: "",
                statementPayment: "",
                statementIncludesExtras: false,
                statementExtraAmount: "",
                interestFree,
              },
            ],
          },
        ],
      });
      await asRole("authenticated", ownerA, async () => {
        assert.equal(Number((await save(0, purchasePayload(true))).version), 1);
        assert.equal(Number((await save(1, purchasePayload(false))).version), 2);
        await rejectsSql(
          () => save(2, purchasePayload("yes")),
          "22023",
          /INVALID_WORKSPACE_PAYLOAD/,
        );
      });
      const rows = await database.query(
        "select version::integer from public.calculation_workspaces",
      );
      assert.deepEqual(rows.rows, [{ version: 2 }]);
    });

    it("rejects forbidden cardNumber keys and malformed, nested or oversized payloads", async () => {
      const invalidPayloads = [
        null,
        {},
        [],
        { cards: [] },
        { cards: "invalid" },
        { cards: [{}] },
        { cards: Array.from({ length: 51 }, () => ({ name: "Ficticio" })) },
        { cards: payload.cards, cardNumber: "fictional-not-a-PAN" },
        { cards: [{ name: "Ficticio", cardNumber: "fictional-not-a-PAN" }] },
        { cards: [{ purchases: [{ cardNumber: "fictional-not-a-PAN" }] }] },
        { cards: [{ purchases: [{ expiry: "fictional" }] }] },
        { cards: [{ name: { nested: "invalid" } }] },
        { cards: [{ purchases: [{}] }] },
        { cards: [{ purchases: {} }] },
        { cards: [{ purchases: [{ description: ["invalid"] }] }] },
        {
          cards: [
            {
              purchases: [
                { ...payload.cards[0], statementIncludesExtras: "yes" },
              ],
            },
          ],
        },
        {
          cards: [
            {
              previousBalanceIncludesCharges: true,
              previousBalanceIncludedCharges: "",
            },
          ],
        },
        {
          cards: [
            {
              previousBalanceIncludesCharges: false,
              previousBalanceIncludedCharges: "20000",
            },
          ],
        },
        {
          cards: [
            {
              previousBalanceIncludesCharges: true,
              previousBalanceIncludedCharges: "invalid",
            },
          ],
        },
        {
          cards: [
            {
              previousBalance: "100000",
              previousBalanceIncludesCharges: true,
              previousBalanceIncludedCharges: "200000",
            },
          ],
        },
        {
          cards: [
            {
              purchases: [
                {
                  statementIncludesExtras: true,
                  statementPayment: "",
                  statementExtraAmount: "",
                },
              ],
            },
          ],
        },
        {
          cards: [
            {
              purchases: [
                {
                  statementIncludesExtras: false,
                  statementExtraAmount: "5000",
                },
              ],
            },
          ],
        },
        { cards: [{ name: "x".repeat(1048577) }] },
      ];
      await asRole("authenticated", ownerA, async () => {
        for (const invalidPayload of invalidPayloads) {
          await rejectsSql(
            () => save(0, invalidPayload),
            "22023",
            /INVALID_WORKSPACE_PAYLOAD/,
          );
        }
      });
      assert.deepEqual(
        (await database.query("select * from public.calculation_workspaces"))
          .rows,
        [],
      );
    });

    it("enforces table CHECK, NOT NULL, primary key and foreign key constraints outside RPCs", async () => {
      const insert = (userId, nextPayload, schemaVersion = 1, version = 1) =>
        database.query(
          "insert into public.calculation_workspaces(user_id, payload, schema_version, version) values ($1, $2::jsonb, $3, $4)",
          [
            userId,
            nextPayload === null ? null : JSON.stringify(nextPayload),
            schemaVersion,
            version,
          ],
        );
      await rejectsSql(() => insert(ownerA, {}), "23514");
      await rejectsSql(() => insert(ownerA, payload, 2), "23514");
      await rejectsSql(() => insert(ownerA, payload, 1, 0), "23514");
      await rejectsSql(() => insert(ownerA, null), "23502");
      await rejectsSql(
        () => insert("00000000-0000-4000-8000-000000000099", payload),
        "23503",
      );
      await insert(ownerA, payload);
      await rejectsSql(() => insert(ownerA, payload), "23505");
      await database.query("delete from auth.users where id = $1", [ownerA]);
      assert.deepEqual(
        (await database.query("select * from public.calculation_workspaces"))
          .rows,
        [],
      );
    });

    it("rejects stale saves without changing the current payload", async () => {
      await asRole("authenticated", ownerA, async () => {
        assert.equal(Number((await save(0)).version), 1);
        const nextPayload = { cards: [{ name: "Revision ficticia" }] };
        assert.equal(Number((await save(1, nextPayload)).version), 2);
        await rejectsSql(() => save(1), "P0001", /SYNC_CONFLICT/);
        await rejectsSql(() => save(0), "P0001", /SYNC_CONFLICT/);
        const current = (
          await database.query(
            "select payload, version::integer from public.calculation_workspaces",
          )
        ).rows;
        assert.deepEqual(current, [{ payload: nextPayload, version: 2 }]);
        for (const invalidVersion of [null, -1]) {
          await rejectsSql(
            () => save(invalidVersion),
            "22023",
            /INVALID_EXPECTED_VERSION/,
          );
        }
        assert.equal(Number((await save(2, nextPayload)).version), 3);
      });
    });

    it("has no deletion RPC and denies authenticated direct deletion without resetting CAS", async () => {
      const deletionFunctions = await database.query(`
      select oid from pg_proc
      where pronamespace = 'public'::regnamespace and proname = 'delete_calculation_workspace'
    `);
      assert.deepEqual(deletionFunctions.rows, []);
      await asRole("authenticated", ownerA, async () => {
        assert.equal(Number((await save(0)).version), 1);
        for (const expectedVersion of [0, 1]) {
          await rejectsSql(
            () =>
              database.query(
                "select public.delete_calculation_workspace($1::bigint)",
                [expectedVersion],
              ),
            "42883",
          );
        }
        await rejectsSql(
          () =>
            database.query(
              "delete from public.calculation_workspaces where user_id = $1",
              [ownerA],
            ),
          "42501",
        );
        assert.deepEqual(
          (
            await database.query(
              "select payload, schema_version, version::integer from public.calculation_workspaces",
            )
          ).rows,
          [{ payload, schema_version: 1, version: 1 }],
        );
        await rejectsSql(() => save(0), "P0001", /SYNC_CONFLICT/);
        assert.equal(Number((await save(1)).version), 2);
        await rejectsSql(() => save(1), "P0001", /SYNC_CONFLICT/);
      });
    });
  },
);
