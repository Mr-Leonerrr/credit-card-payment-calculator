export const number = (value) =>
  Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export const integer = (value, min = 1, max = 120) =>
  Math.min(max, Math.max(min, Math.trunc(number(value))));
export const money = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number(value));

export function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateParts(value) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function cutoffInMonth(reference, offset, cutoffDay) {
  const { year, month } = dateParts(reference);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const date = new Date(
    Date.UTC(
      first.getUTCFullYear(),
      first.getUTCMonth(),
      Math.min(integer(cutoffDay, 1, 31), lastDay),
    ),
  );
  return date.toISOString().slice(0, 10);
}

export function nextCutoff(reference, cutoffDay) {
  const current = cutoffInMonth(reference, 0, cutoffDay);
  return current >= reference
    ? current
    : cutoffInMonth(reference, 1, cutoffDay);
}

export function monthlyRate(card) {
  return card.rateType === "annual"
    ? Math.pow(1 + number(card.rate) / 100, 1 / 12) - 1
    : number(card.rate) / 100;
}

export function purchaseBalance(purchase) {
  if (purchase.entryMode === "statement")
    return number(purchase.statementBalance);
  const total = integer(purchase.installments);
  return (
    (number(purchase.amount) *
      (total - integer(purchase.paidInstallments, 0, total))) /
    total
  );
}

export function purchaseMonthlyRate(purchase, defaultRate) {
  if (purchase.rateOverride === "" || purchase.rateOverride == null)
    return defaultRate;
  const rate = number(purchase.rateOverride) / 100;
  return purchase.rateOverrideType === "annual"
    ? Math.pow(1 + rate, 1 / 12) - 1
    : rate;
}

export function project(card, months = 6) {
  const rate = monthlyRate(card);
  const firstCutoff = nextCutoff(card.referenceDate || today(), card.cutoffDay);
  const reportedPreviousBalance = number(card.previousBalance);
  const includedPreviousCharges = card.previousBalanceIncludesCharges
    ? Math.min(reportedPreviousBalance, number(card.previousBalanceIncludedCharges))
    : 0;
  let previousBalance = Math.max(0, reportedPreviousBalance - includedPreviousCharges);
  const purchases = card.purchases.map((purchase) => {
    const installments = integer(purchase.installments);
    const paid = integer(purchase.paidInstallments, 0, installments);
    const first = nextCutoff(
      purchase.date || card.referenceDate || today(),
      card.cutoffDay,
    );
    const remaining =
      purchase.entryMode === "statement"
        ? integer(purchase.statementRemaining, 0, installments)
        : installments - paid;
    return {
      ...purchase,
      installments,
      balance: purchaseBalance(purchase),
      remaining,
      capital:
        purchase.entryMode === "statement"
          ? number(purchase.statementCapital) ||
            purchaseBalance(purchase) / Math.max(1, remaining)
          : number(purchase.amount) / installments,
      nextDate:
        purchase.entryMode === "statement"
          ? nextCutoff(
              purchase.statementNextDate || card.referenceDate || today(),
              card.cutoffDay,
            )
          : cutoffInMonth(first, paid, card.cutoffDay),
    };
  });
  const rows = [];
  for (let month = 0; month < integer(months, 1, 12); month += 1) {
    const date = cutoffInMonth(firstCutoff, month, card.cutoffDay);
    const active = purchases.filter(
      (purchase) =>
        purchase.balance > 0.005 &&
        purchase.remaining > 0 &&
        purchase.nextDate <= date,
    );
    const previousCapital = Math.min(
      previousBalance,
      Math.max(
        (previousBalance * Math.min(100, number(card.minimumPercent))) / 100,
        number(card.minimumFloor),
      ),
    );
    const details = active.map((purchase) => {
      const interest =
        purchase.entryMode !== "statement" &&
        purchase.installments === 1 &&
        card.interestFreeSingle
          ? 0
          : purchase.balance * purchaseMonthlyRate(purchase, rate);
      const includedExtra = purchase.statementIncludesExtras
        ? number(purchase.statementExtraAmount)
        : 0;
      const statementPrincipal =
        purchase.statementPayment != null && purchase.statementPayment !== ""
          ? Math.max(
              0,
              number(purchase.statementPayment) - interest - includedExtra,
            )
          : purchase.capital;
      return {
        id: purchase.id,
        description: purchase.description,
        capital:
          purchase.remaining === 1
            ? purchase.balance
            : Math.min(purchase.balance, statementPrincipal),
        interest,
        extraCharges: includedExtra,
      };
    });
    const purchaseCapital = details.reduce(
      (sum, detail) => sum + detail.capital,
      0,
    );
    const interest =
      previousBalance * rate +
      details.reduce((sum, detail) => sum + detail.interest, 0);
    const statementCharges = details.reduce(
      (sum, detail) => sum + detail.extraCharges,
      0,
    );
    const charges =
      number(card.recurringCharges) +
      statementCharges +
      (month === 0
        ? number(card.extraCharges) + includedPreviousCharges
        : 0);
    const capital = previousCapital + purchaseCapital;
    const grossMinimum = capital + interest + charges;
    const payment = month === 0 ? number(card.payments) : 0;
    const activeDebt =
      previousBalance +
      active.reduce((sum, purchase) => sum + purchase.balance, 0);
    const minimum = Math.max(0, grossMinimum - payment);
    const totalPayment = Math.max(0, activeDebt + interest + charges - payment);
    let extra = Math.max(0, payment - grossMinimum);
    previousBalance = Math.max(0, previousBalance - previousCapital);
    const previousExtra = Math.min(previousBalance, extra);
    previousBalance -= previousExtra;
    extra -= previousExtra;
    for (const purchase of active) {
      const detail = details.find((item) => item.id === purchase.id);
      purchase.balance = Math.max(0, purchase.balance - detail.capital);
      purchase.remaining -= 1;
    }
    for (const purchase of purchases) {
      const applied = Math.min(purchase.balance, extra);
      purchase.balance -= applied;
      extra -= applied;
    }
    const remaining =
      previousBalance +
      purchases.reduce((sum, purchase) => sum + purchase.balance, 0);
    rows.push({
      date,
      previousCapital,
      purchaseCapital,
      capital,
      interest,
      charges,
      grossMinimum,
      payment,
      minimum,
      totalPayment,
      remaining,
      details,
      unappliedPayment: extra,
    });
  }
  return {
    rows,
    rate,
    previousBalance: Math.max(
      0,
      reportedPreviousBalance - includedPreviousCharges,
    ),
    purchaseBalance: card.purchases.reduce(
      (sum, purchase) => sum + purchaseBalance(purchase),
      0,
    ),
    totalPending:
      card.creditLimit == null ||
      card.creditLimit === "" ||
      card.availableCredit == null ||
      card.availableCredit === ""
        ? null
        : Math.max(0, number(card.creditLimit) - number(card.availableCredit)),
    totalInterest: rows.reduce((sum, row) => sum + row.interest, 0),
    totalMinimum: rows.reduce((sum, row) => sum + row.minimum, 0),
  };
}
