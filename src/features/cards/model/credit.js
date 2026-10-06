const amount = (value) => Number(value || 0);
const rounded = (value) => String(Number(value.toFixed(2)));

export function reduceAvailableCredit(available, purchaseAmount) {
  if (available === "" || available == null) return "";
  return rounded(Math.max(0, amount(available) - amount(purchaseAmount)));
}

export function increaseAvailableCredit(available, paymentAmount, creditLimit) {
  if (available === "" || available == null) return "";
  const next = amount(available) + amount(paymentAmount);
  return rounded(creditLimit === "" || creditLimit == null
    ? next
    : Math.min(amount(creditLimit), next));
}

export function adjustAvailableCredit(available, delta, creditLimit = "") {
  if (available === "" || available == null) return "";
  const next = amount(available) + amount(delta);
  return rounded(
    Math.min(
      creditLimit === "" || creditLimit == null ? Infinity : amount(creditLimit),
      Math.max(0, next),
    ),
  );
}
