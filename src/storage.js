import { today, integer } from "./calculator.js";

export const STORAGE_KEY = "tarjeta-cuota-calculador-v2";
export const LEGACY_KEY = "tarjeta-cuota-calculador-v1";
const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const numeric = (value, fallback = "") => Number.isFinite(Number(value)) && Number(value) >= 0 ? String(value) : fallback;

export function newCard(name = "Mi tarjeta") {
  return {
    id: crypto.randomUUID(), name, rate: "2", rateType: "monthly", cutoffDay: "20",
    referenceDate: today(), previousBalance: "", minimumPercent: "5", minimumFloor: "0",
    recurringCharges: "", extraCharges: "", payments: "", interestFreeSingle: true,
    creditLimit: "", availableCredit: "",
    purchases: [],
  };
}

export function normalizeCard(raw) {
  const defaults = newCard();
  const card = { ...defaults, id: typeof raw.id === "string" ? raw.id : defaults.id,
    name: String(raw.name || defaults.name).slice(0, 80),
    rateType: raw.rateType === "annual" ? "annual" : "monthly",
    referenceDate: validDate(raw.referenceDate) ? raw.referenceDate : defaults.referenceDate,
    cutoffDay: String(integer(raw.cutoffDay || 20, 1, 31)),
    interestFreeSingle: raw.interestFreeSingle !== false,
  };
  for (const field of ["rate", "previousBalance", "minimumPercent", "minimumFloor", "recurringCharges", "extraCharges", "payments", "creditLimit", "availableCredit"]) {
    card[field] = numeric(raw[field] ?? defaults[field], defaults[field]);
  }
  card.purchases = (Array.isArray(raw.purchases) ? raw.purchases : []).filter((purchase) => purchase && Number(purchase.amount) > 0).map((purchase) => {
    const installments = integer(purchase.installments);
    return {
      id: typeof purchase.id === "string" ? purchase.id : crypto.randomUUID(),
      description: String(purchase.description || "Compra").slice(0, 120),
      amount: numeric(purchase.amount), installments: String(installments),
      paidInstallments: String(integer(purchase.paidInstallments, 0, installments)),
      date: validDate(purchase.date) ? purchase.date : card.referenceDate,
      rateOverride: purchase.rateOverride == null || purchase.rateOverride === "" ? "" : numeric(purchase.rateOverride),
      rateOverrideType: purchase.rateOverrideType === "annual" ? "annual" : "monthly",
      entryMode: purchase.entryMode === "statement" ? "statement" : "purchase",
      processDate: validDate(purchase.processDate) ? purchase.processDate : "",
      statementBalance: numeric(purchase.statementBalance ?? ""),
      statementRemaining: String(integer(purchase.statementRemaining, 0, installments)),
      statementCapital: numeric(purchase.statementCapital ?? ""),
      statementNextDate: validDate(purchase.statementNextDate) ? purchase.statementNextDate : card.referenceDate,
    };
  });
  return card;
}

export function loadWorkspace(storage) {
  const fallback = () => { const card = newCard(); return { cards: [card], activeId: card.id, theme: "light", horizon: 6 }; };
  try {
    const source = storage || globalThis.localStorage;
    const saved = source.getItem(STORAGE_KEY);
    if (saved) {
      const raw = JSON.parse(saved);
      if (!Array.isArray(raw.cards) || !raw.cards.length || raw.cards.some((card) => !card || typeof card !== "object")) throw new Error("Invalid cards");
      const cards = raw.cards.map(normalizeCard);
      return { data: { cards, activeId: cards.some((card) => card.id === raw.activeId) ? raw.activeId : cards[0].id,
        theme: raw.theme === "dark" ? "dark" : "light", horizon: [3, 6, 12].includes(raw.horizon) ? raw.horizon : 6 }, notice: "" };
    }
    const legacy = source.getItem(LEGACY_KEY);
    if (legacy) {
      const raw = JSON.parse(legacy);
      const base = newCard();
      const purchases = Array.isArray(raw.purchases) ? raw.purchases : [];
      const card = normalizeCard({ ...base, previousBalance: raw.pendingBalance, extraCharges: raw.extraCharges,
        payments: raw.payments, rate: purchases.find((purchase) => Number(purchase?.monthlyRate) > 0)?.monthlyRate || "2",
        purchases: purchases.filter(Boolean).map((purchase) => ({ ...purchase, rateOverride: purchase.monthlyRate ?? "", date: today(), paidInstallments: "0" })) });
      return { data: { cards: [card], activeId: card.id, theme: "light", horizon: 6 },
        notice: "Datos anteriores recuperados. Revisa las fechas, la tasa y el saldo anterior: no debe incluir el capital de las compras registradas." };
    }
    return { data: fallback(), notice: "" };
  } catch {
    return { data: fallback(), blocked: true, notice: "No fue posible leer los datos guardados. Los datos originales no se han eliminado; revisa el almacenamiento del navegador." };
  }
}
