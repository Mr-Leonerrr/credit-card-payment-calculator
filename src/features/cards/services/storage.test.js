import test from "node:test";
import assert from "node:assert/strict";
import {
  loadWorkspace,
  newCard,
  normalizeCard,
  STORAGE_KEY,
  LEGACY_KEY,
} from "./storage.js";
import {
  monthlyRate,
  project,
  purchaseMonthlyRate,
} from "../../calculator/model/calculator.js";

const storage = (entries) => ({ getItem: (key) => entries[key] ?? null });
test("migra saldo anterior y compras sin perder tasas particulares", () => {
  const original = {
    pendingBalance: "500000",
    payments: "10000",
    extraCharges: "2000",
    purchases: [
      {
        id: 1,
        description: "Compra antigua",
        amount: "120000",
        installments: "3",
        monthlyRate: "1.5",
      },
      { amount: "", installments: "1" },
    ],
  };
  const result = loadWorkspace(
    storage({ [LEGACY_KEY]: JSON.stringify(original) }),
  );
  const card = result.data.cards[0];
  assert.equal(card.previousBalance, "500000");
  assert.equal(card.purchases.length, 1);
  assert.equal(card.purchases[0].rateOverride, "1.5");
  assert.equal(card.payments, "10000");
  assert.ok(result.notice);
});
test("restaura varias tarjetas independientes, selección, tema y horizonte", () => {
  const first = newCard("Principal");
  const second = newCard("Viajes");
  second.previousBalance = "900000";
  const data = {
    cards: [first, second],
    activeId: second.id,
    theme: "dark",
    horizon: 12,
  };
  const restored = loadWorkspace(
    storage({ [STORAGE_KEY]: JSON.stringify(data) }),
  ).data;
  assert.equal(restored.cards.length, 2);
  assert.equal(restored.activeId, second.id);
  assert.equal(restored.cards[0].previousBalance, "");
  assert.equal(restored.cards[1].previousBalance, "900000");
  assert.equal(restored.theme, "dark");
  assert.equal(restored.horizon, 12);
});
test("datos corruptos bloquean el guardado y no modifican los originales", () => {
  const result = loadWorkspace(storage({ [STORAGE_KEY]: "{broken" }));
  assert.equal(result.blocked, true);
  assert.equal(result.data.cards.length, 1);
  assert.ok(result.notice);
});
test("un navegador sin acceso al almacenamiento no impide abrir la aplicación", () => {
  const result = loadWorkspace({
    getItem() {
      throw new Error("Storage denied");
    },
  });
  assert.equal(result.blocked, true);
  assert.equal(result.data.cards.length, 1);
});
test("normaliza valores, fechas e identificadores antiguos", () => {
  const card = normalizeCard({
    cutoffDay: 99,
    rate: "Infinity",
    referenceDate: "2026-02-31",
    purchases: [
      { amount: 100, installments: 3, paidInstallments: 99, date: "bad" },
      null,
    ],
  });
  assert.equal(card.cutoffDay, "31");
  assert.equal(card.rate, "2");
  assert.equal(card.purchases[0].paidInstallments, "3");
  assert.doesNotThrow(() => project(card, 12));
});
test("cupos se guardan de forma independiente por tarjeta, incluido disponible cero", () => {
  const first = {
    ...newCard("Principal"),
    creditLimit: "5000000",
    availableCredit: "3000000",
  };
  const second = {
    ...newCard("Viajes"),
    creditLimit: "2000000",
    availableCredit: "0",
  };
  const restored = loadWorkspace(
    storage({
      [STORAGE_KEY]: JSON.stringify({
        cards: [first, second],
        activeId: first.id,
      }),
    }),
  ).data;
  assert.equal(restored.cards[0].creditLimit, "5000000");
  assert.equal(restored.cards[0].availableCredit, "3000000");
  assert.equal(restored.cards[1].creditLimit, "2000000");
  assert.equal(restored.cards[1].availableCredit, "0");
});
test("tarjetas antiguas o cupos inválidos quedan sin registrar, no en cero", () => {
  assert.equal(normalizeCard({}).creditLimit, "");
  assert.equal(normalizeCard({}).availableCredit, "");
  assert.equal(
    normalizeCard({ creditLimit: -1, availableCredit: "Infinity" }).creditLimit,
    "",
  );
  assert.equal(
    normalizeCard({ creditLimit: -1, availableCredit: "Infinity" })
      .availableCredit,
    "",
  );
});
test("tarjetas guardadas antiguas obtienen el desglose de intereses apagado", () => {
  const card = normalizeCard({ previousBalance: "1000000" });
  assert.equal(card.previousBalance, "1000000");
  assert.equal(card.previousBalanceIncludesCharges, false);
  assert.equal(card.previousBalanceIncludedCharges, "");
});
test("las compras promocionales al 0% se conservan y las antiguas mantienen su tasa", () => {
  const restored = normalizeCard({
    purchases: [
      { id: "promo", amount: "300000", interestFree: true },
      { id: "normal", amount: "300000" },
    ],
  });
  assert.equal(restored.purchases[0].interestFree, true);
  assert.equal(restored.purchases[1].interestFree, false);
});
test("saldo anterior y cargos ya incluidos se conservan al recargar", () => {
  const original = {
    ...newCard("Principal"),
    previousBalance: "1000000",
    previousBalanceIncludesCharges: true,
    previousBalanceIncludedCharges: "20000",
  };
  const restored = loadWorkspace(
    storage({
      [STORAGE_KEY]: JSON.stringify({ cards: [original], activeId: original.id }),
    }),
  ).data.cards[0];
  assert.equal(restored.previousBalance, "1000000");
  assert.equal(restored.previousBalanceIncludesCharges, true);
  assert.equal(restored.previousBalanceIncludedCharges, "20000");
});
test("modo extracto conserva saldo, cuotas, fecha de proceso y tasa EA al recargar", () => {
  const original = {
    ...newCard(),
    referenceDate: "2025-04-05",
    cutoffDay: "20",
    purchases: [
      {
        id: "refinance",
        description: "Refinanciación ficticia",
        entryMode: "statement",
        amount: "2400000",
        installments: "6",
        date: "2025-01-10",
        processDate: "2025-01-12",
        statementBalance: "800003",
        statementRemaining: "4",
        statementCapital: "200001",
        statementPayment: "240000",
        statementIncludesExtras: true,
        statementExtraAmount: "5000",
        statementPayment: "240000",
        statementIncludesExtras: true,
        statementExtraAmount: "5000",
        statementNextDate: "2025-04-20",
        rateOverride: "24.5",
        rateOverrideType: "annual",
      },
    ],
  };
  const restored = loadWorkspace(
    storage({
      [STORAGE_KEY]: JSON.stringify({
        cards: [original],
        activeId: original.id,
      }),
    }),
  ).data.cards[0];
  assert.equal(restored.purchases[0].entryMode, "statement");
  assert.equal(restored.purchases[0].statementBalance, "800003");
  assert.equal(restored.purchases[0].statementRemaining, "4");
  assert.equal(restored.purchases[0].processDate, "2025-01-12");
  assert.equal(restored.purchases[0].rateOverrideType, "annual");
  assert.equal(restored.purchases[0].statementPayment, "240000");
  assert.equal(restored.purchases[0].statementIncludesExtras, true);
  assert.equal(restored.purchases[0].statementExtraAmount, "5000");
  assert.equal(restored.purchases[0].statementPayment, "240000");
  assert.equal(restored.purchases[0].statementIncludesExtras, true);
  assert.equal(restored.purchases[0].statementExtraAmount, "5000");
  assert.equal(project(restored, 6).purchaseBalance, 800003);
  const monthlyInterest =
    Number(restored.purchases[0].statementBalance) *
    purchaseMonthlyRate(restored.purchases[0], monthlyRate(restored));
  assert.ok(
    Math.abs(
      project(restored, 6).rows[0].purchaseCapital -
        (240000 - monthlyInterest - 5000),
    ) < 1e-8,
  );
});
