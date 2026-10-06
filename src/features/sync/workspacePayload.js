import {
  newCard,
  normalizeCard,
  STORAGE_KEY,
} from "../cards/services/storage.js";

export const CARD_KEYS = [
  "id",
  "name",
  "rate",
  "rateType",
  "cutoffDay",
  "referenceDate",
  "previousBalance",
  "previousBalanceIncludesCharges",
  "previousBalanceIncludedCharges",
  "minimumPercent",
  "minimumFloor",
  "recurringCharges",
  "extraCharges",
  "payments",
  "interestFreeSingle",
  "creditLimit",
  "availableCredit",
  "paymentHistory",
  "purchases",
];
export const PURCHASE_KEYS = [
  "id",
  "description",
  "amount",
  "installments",
  "paidInstallments",
  "date",
  "rateOverride",
  "interestFree",
  "creditImpact",
  "rateOverrideType",
  "entryMode",
  "processDate",
  "statementBalance",
  "statementRemaining",
  "statementCapital",
  "statementPayment",
  "statementIncludesExtras",
  "statementExtraAmount",
  "statementNextDate",
];

function requireValid(condition) {
  if (!condition) throw new Error("INVALID_WORKSPACE_PAYLOAD");
}

function exactKeys(value, keys) {
  requireValid(
    value !== null && typeof value === "object" && !Array.isArray(value),
  );
  requireValid(
    Object.keys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key)),
  );
}

function text(value, maximum, required = false) {
  requireValid(
    typeof value === "string" &&
      value.length <= maximum &&
      (!required || value.trim().length > 0),
  );
}

function numeric(
  value,
  { optional = false, minimum = 0, maximum = Infinity, integer = false } = {},
) {
  if (optional && value === "") return;
  requireValid(
    ["number", "string"].includes(typeof value) &&
      /^\d+(?:\.\d+)?$/.test(String(value)) &&
      Number.isFinite(Number(value)) &&
      Number(value) >= minimum &&
      Number(value) <= maximum &&
      (!integer || Number.isInteger(Number(value))),
  );
}

function date(value, optional = false) {
  if (optional && value === "") return;
  requireValid(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
  const parsed = new Date(`${value}T00:00:00Z`);
  requireValid(
    !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value,
  );
}

function rateType(value) {
  requireValid(value === "monthly" || value === "annual");
}

export function validatePayload(payload) {
  exactKeys(payload, ["cards"]);
  requireValid(
    Array.isArray(payload.cards) &&
      payload.cards.length >= 1 &&
      payload.cards.length <= 50,
  );
  const identifiers = new Set();
  for (const card of payload.cards) {
    exactKeys(card, CARD_KEYS);
    text(card.id, 128, true);
    requireValid(!identifiers.has(card.id));
    identifiers.add(card.id);
    text(card.name, 80, true);
    rateType(card.rateType);
    numeric(card.rate);
    numeric(card.cutoffDay, { minimum: 1, maximum: 31, integer: true });
    numeric(card.minimumPercent, { maximum: 100 });
    numeric(card.minimumFloor);
    requireValid(typeof card.previousBalanceIncludesCharges === "boolean");
    numeric(card.previousBalanceIncludedCharges, { optional: true });
    requireValid(
      card.previousBalanceIncludesCharges ||
        card.previousBalanceIncludedCharges === "",
    );
    requireValid(
      !card.previousBalanceIncludesCharges ||
        card.previousBalanceIncludedCharges !== "",
    );
    requireValid(
      !card.previousBalanceIncludesCharges ||
        Number(card.previousBalanceIncludedCharges) <=
          Number(card.previousBalance),
    );
    date(card.referenceDate);
    requireValid(typeof card.interestFreeSingle === "boolean");
    for (const key of [
      "previousBalance",
      "recurringCharges",
      "extraCharges",
      "payments",
      "creditLimit",
      "availableCredit",
    ]) {
      numeric(card[key], { optional: true });
    }
    requireValid(Array.isArray(card.purchases));
    requireValid(Array.isArray(card.paymentHistory));
    const paymentIds = new Set();
    for (const payment of card.paymentHistory) {
      exactKeys(payment, [
        "id",
        "date",
        "amount",
        "availableApplied",
        "availableChange",
      ]);
      text(payment.id, 128, true);
      requireValid(!paymentIds.has(payment.id));
      paymentIds.add(payment.id);
      date(payment.date);
      numeric(payment.amount, { minimum: Number.MIN_VALUE });
      numeric(payment.availableChange);
      requireValid(typeof payment.availableApplied === "boolean");
    }
    const purchaseIds = new Set();
    for (const purchase of card.purchases) {
      exactKeys(purchase, PURCHASE_KEYS);
      text(purchase.id, 128, true);
      requireValid(!purchaseIds.has(purchase.id));
      purchaseIds.add(purchase.id);
      text(purchase.description, 120);
      requireValid(
        purchase.entryMode === "purchase" || purchase.entryMode === "statement",
      );
      numeric(purchase.amount, {
        optional: purchase.entryMode === "statement",
        minimum: purchase.entryMode === "purchase" ? Number.MIN_VALUE : 0,
      });
      numeric(purchase.installments, { minimum: 1, integer: true });
      numeric(purchase.paidInstallments, {
        maximum: Number(purchase.installments),
        integer: true,
      });
      date(purchase.date);
      numeric(purchase.rateOverride, { optional: true });
      requireValid(typeof purchase.interestFree === "boolean");
      requireValid(typeof purchase.creditImpact === "boolean");
      rateType(purchase.rateOverrideType);
      date(purchase.processDate, true);
      numeric(purchase.statementBalance, {
        optional: purchase.entryMode !== "statement",
      });
      numeric(purchase.statementCapital, { optional: true });
      numeric(purchase.statementPayment, { optional: true });
      requireValid(typeof purchase.statementIncludesExtras === "boolean");
      numeric(purchase.statementExtraAmount, { optional: true });
      requireValid(
        !purchase.statementIncludesExtras ||
          (purchase.statementPayment !== "" &&
            purchase.statementExtraAmount !== ""),
      );
      requireValid(
        purchase.statementIncludesExtras ||
          purchase.statementExtraAmount === "",
      );
      numeric(purchase.statementRemaining, { integer: true });
      date(purchase.statementNextDate, purchase.entryMode !== "statement");
    }
  }
  requireValid(
    new TextEncoder().encode(JSON.stringify(payload)).length <= 1048576,
  );
  return payload;
}

function copyKeys(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

export function serializeWorkspace(workspace) {
  const payload = { cards: workspace.cards };
  validatePayload(payload);
  return {
    cards: payload.cards.map((card) => ({
      ...copyKeys(card, CARD_KEYS),
      purchases: card.purchases.map((purchase) =>
        copyKeys(purchase, PURCHASE_KEYS),
      ),
    })),
  };
}

export function emptyWorkspace() {
  const card = newCard();
  return { cards: [card], activeId: card.id, theme: "light", horizon: 6 };
}

export function hydratePayload(payload, preferences = {}) {
  validatePayload(payload);
  const cards = payload.cards.map((card) => ({
    ...normalizeCard({ ...card, purchases: [] }),
    purchases: card.purchases.map((purchase) => ({
      ...copyKeys(purchase, PURCHASE_KEYS),
      ...Object.fromEntries(
        [
          "amount",
          "installments",
          "paidInstallments",
          "rateOverride",
          "statementBalance",
          "statementRemaining",
          "statementCapital",
        ].map((key) => [key, String(purchase[key])]),
      ),
    })),
  }));
  return {
    cards,
    activeId: cards.some((card) => card.id === preferences.activeId)
      ? preferences.activeId
      : cards[0].id,
    theme: preferences.theme === "dark" ? "dark" : "light",
    horizon: [3, 6, 12].includes(preferences.horizon) ? preferences.horizon : 6,
  };
}

export function validateRow(row, userId) {
  requireValid(row?.user_id === userId && row.schema_version === 1);
  requireValid(Number.isSafeInteger(row.version) && row.version > 0);
  requireValid(Array.isArray(row.payload?.cards));
  const payload = {
    ...row.payload,
    cards: row.payload.cards.map((card) => ({
      previousBalanceIncludesCharges: false,
      previousBalanceIncludedCharges: "",
      ...card,
      purchases: Array.isArray(card?.purchases)
        ? card.purchases.map((purchase) => ({
            ...purchase,
            statementPayment: purchase.statementPayment ?? "",
            interestFree: purchase.interestFree ?? false,
            creditImpact: purchase.creditImpact ?? false,
            statementIncludesExtras: purchase.statementIncludesExtras ?? false,
            statementExtraAmount: purchase.statementExtraAmount ?? "",
          }))
        : card?.purchases,
      paymentHistory: Array.isArray(card?.paymentHistory)
        ? card.paymentHistory.map((payment) => ({
            ...payment,
            availableChange: payment.availableChange ?? "0",
          }))
        : [],
    })),
  };
  validatePayload(payload);
  return { ...row, payload };
}

export function hasRealData(payload) {
  validatePayload(payload);
  const defaults = newCard();
  return (
    payload.cards.length > 1 ||
    payload.cards.some(
      (card) =>
        card.purchases.length > 0 ||
        CARD_KEYS.some(
          (key) =>
            !["id", "referenceDate", "purchases"].includes(key) &&
            String(card[key]) !== String(defaults[key]),
        ),
    )
  );
}

export function readGuestPayload(storage) {
  const saved = storage?.getItem(STORAGE_KEY);
  if (!saved) return null;
  const raw = JSON.parse(saved);
  const payload = serializeWorkspace({
    cards: Array.isArray(raw.cards) ? raw.cards.map(normalizeCard) : raw.cards,
  });
  return hasRealData(payload) ? payload : null;
}

export function importLocalPayload(
  workspace,
  guestPayload,
  makeId = () => crypto.randomUUID(),
) {
  validatePayload(guestPayload);
  const imported = hydratePayload(guestPayload).cards.map((card) => ({
    ...card,
    id: makeId(),
    purchases: card.purchases.map((purchase) => ({
      ...purchase,
      id: makeId(),
    })),
  }));
  const next = { ...workspace, cards: [...workspace.cards, ...imported] };
  serializeWorkspace(next);
  return next;
}
