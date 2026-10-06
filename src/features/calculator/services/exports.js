import { money, purchaseBalance } from "../model/calculator.js";

const columns = [
  "Corte",
  "Capital anterior",
  "Capital compras",
  "Intereses",
  "Cargos",
  "Abonos registrados",
  "Pago mínimo",
  "Pago total al corte",
  "Capital restante",
];
const values = (row) => [
  row.date,
  row.previousCapital,
  row.purchaseCapital,
  row.interest,
  row.charges,
  row.payment,
  row.minimum,
  row.totalPayment,
  row.remaining,
];
const filename = (card) =>
  `calculo-${card.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")}-${card.referenceDate}`;
const disclaimer =
  "Estimación: capital constante, interés mensual sobre saldo. No incluye mora ni interés diario. La proyección supone pagar el mínimo cada mes. Las condiciones de tu banco prevalecen.";

export function exportCSV(card, result) {
  const safeCell = (value) => {
    const text = String(value ?? "");
    return `"${(/^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  const rows = [
    ["Tarjeta", card.name],
    ["Fecha de cálculo", card.referenceDate],
    [
      "Tasa configurada (%)",
      card.rate,
      card.rateType === "annual" ? "EA" : "MV",
    ],
    ["Tasa mensual equivalente (%)", result.rate * 100],
    ["Día de corte", card.cutoffDay],
    ["Capital saldo anterior", result.previousBalance],
    ["Saldo anterior informado", card.previousBalance],
    [
      "Saldo anterior incluye intereses/cargos",
      card.previousBalanceIncludesCharges ? "Sí" : "No",
    ],
    [
      "Intereses/cargos ya incluidos en saldo",
      card.previousBalanceIncludedCharges,
    ],
    ["Abonos totales realizados", card.payments],
    ["Capital compras pendiente", result.purchaseBalance],
    ["Cupo total de la tarjeta", card.creditLimit ?? ""],
    ["Cupo actual disponible", card.availableCredit ?? ""],
    [
      "Pago total pendiente estimad",
      result.totalPending == null
        ? "Sin registrar"
        : result.totalPending.toFixed(2),
    ],
    [
      "Pago total pendiente",
      "Cupo total menos cupo actual disponible. No se suman nuevamente compras, intereses, cargos ni abonos.",
    ],
    ["Capital mínimo anterior (%)", card.minimumPercent],
    ["Piso de capital anterior", card.minimumFloor],
    ["Una cuota sin intereses", card.interestFreeSingle ? "Sí" : "No"],
    ["Supuestos", disclaimer],
    [],
    columns,
    ...result.rows.map((row) =>
      values(row).map((value, index) =>
        index === 0 ? value : value.toFixed(2),
      ),
    ),
    [],
    [
      "Compra",
      "Fecha",
      "Valor original",
      "Cuotas totales",
      "Cuotas pagadas",
      "Cuotas pendientes",
      "Capital pendiente",
      "Tasa particular (%)",
      "Compra sin intereses (0%)",
      "Tipo de tasa",
      "Origen",
      "Fecha de proceso",
      "Capital cuota reportado",
      "Cuota total reportada con interés EA",
      "Incluye mora u otros adicionales",
      "Valor adicional por cuota",
      "Primer corte",
    ],
    ...card.purchases.map((purchase) => [
      purchase.description,
      purchase.date,
      purchase.amount,
      purchase.installments,
      purchase.entryMode === "statement" ? "" : purchase.paidInstallments,
      purchase.entryMode === "statement"
        ? purchase.statementRemaining
        : Number(purchase.installments) - Number(purchase.paidInstallments),
      purchaseBalance(purchase).toFixed(2),
      purchase.rateOverride,
      purchase.interestFree ? "Sí" : "No",
      purchase.rateOverrideType === "annual" ? "EA" : "MV",
      purchase.entryMode === "statement" ? "Extracto" : "Compra",
      purchase.processDate || "",
      purchase.statementCapital || "",
      purchase.statementPayment || "",
      purchase.statementIncludesExtras ? "Sí" : "No",
      purchase.statementExtraAmount || "",
      purchase.statementNextDate || "",
    ]),
    [],
    ["Historial de pagos"],
    ["Fecha", "Valor pagado", "Aumentó el cupo", "Ajuste efectivo de cupo"],
    ...(card.paymentHistory || []).map((payment) => [
      payment.date,
      payment.amount,
      payment.availableApplied ? "Sí" : "No",
      payment.availableChange,
    ]),
  ];
  const blob = new Blob(
    ["\uFEFF", rows.map((row) => row.map(safeCell).join(";")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename(card)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportPDF(card, result) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const creditValue = (value) =>
    value == null || value === "" ? "Sin registrar" : money(value);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(19);
  doc.text(`Estado estimado - ${card.name}`, 14, 20);
  doc.setFontSize(10);
  doc.text(
    `Fecha: ${card.referenceDate} | Corte: día ${card.cutoffDay} | Tasa: ${card.rate}% ${card.rateType === "annual" ? "EA" : "MV"} (${(result.rate * 100).toFixed(3)}% mensual)`,
    14,
    29,
  );
  doc.text(
    `Saldo anterior: ${money(result.previousBalance)} | Compras pendientes: ${money(result.purchaseBalance)} | Pago mínimo: ${money(result.rows[0].minimum)}`,
    14,
    37,
  );
  doc.text(
    `Saldo anterior informado: ${creditValue(card.previousBalance)} | Ya incluye intereses/cargos: ${card.previousBalanceIncludesCharges ? creditValue(card.previousBalanceIncludedCharges) : "No"} | Abonos totales: ${money(card.payments)}`,
    14,
    45,
  );
  doc.text(
    `Capital mínimo anterior: ${card.minimumPercent}% / piso ${money(card.minimumFloor)} | Una cuota sin intereses: ${card.interestFreeSingle ? "Sí" : "No"}`,
    14,
    53,
  );
  doc.text(
    `Cupo total: ${creditValue(card.creditLimit)} | Cupo disponible informado: ${creditValue(card.availableCredit)} | Pago total pendiente estimad: ${creditValue(result.totalPending)}`,
    14,
    61,
  );
  doc.text(
    "Pago total pendiente: cupo total menos cupo actual disponible. Sin sumar nuevamente compras, intereses, cargos ni abonos.",
    14,
    69,
  );
  doc.text(doc.splitTextToSize(disclaimer, 265), 14, 77);
  autoTable(doc, {
    startY: 90,
    head: [columns],
    body: result.rows.map((row) =>
      values(row).map((value, index) => (index === 0 ? value : money(value))),
    ),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [16, 110, 91] },
  });
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 12,
    head: [
      [
        "Compra",
        "Fecha",
        "Valor",
        "Cuotas",
        "Pagadas",
        "Pendientes",
        "Capital pendiente",
        "Tasa particular",
        "Sin interés 0%",
      ],
    ],
    body: card.purchases.map((purchase) => [
      purchase.description,
      purchase.date,
      money(purchase.amount),
      purchase.installments,
      purchase.entryMode === "statement"
        ? "No inferidas"
        : purchase.paidInstallments,
      purchase.entryMode === "statement"
        ? purchase.statementRemaining
        : Number(purchase.installments) - Number(purchase.paidInstallments),
      money(purchaseBalance(purchase)),
      purchase.interestFree ? "Sí" : "No",
      purchase.rateOverride === ""
        ? "Tarjeta"
        : `${purchase.rateOverride}% ${purchase.rateOverrideType === "annual" ? "EA" : "MV"}`,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 110, 91] },
  });
  const statements = card.purchases.filter(
    (purchase) => purchase.entryMode === "statement",
  );
  if (statements.length)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 12,
      head: [
        [
          "Movimiento del extracto",
          "Fecha de proceso",
          "Primer corte proyectado",
          "Saldo reportado",
          "Cuota de capital reportada",
          "Cuota total reportada",
          "Incluye cargos adicionales",
          "Valor adicional por cuota",
        ],
      ],
      body: statements.map((purchase) => [
        purchase.description,
        purchase.processDate || "",
        purchase.statementNextDate,
        money(purchase.statementBalance),
        purchase.statementCapital === ""
          ? "Saldo / pendientes"
          : money(purchase.statementCapital),
        purchase.statementPayment === ""
          ? "Estimación interna"
          : money(purchase.statementPayment),
        purchase.statementIncludesExtras ? "Sí" : "No",
        purchase.statementExtraAmount === ""
          ? ""
          : money(purchase.statementExtraAmount),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 110, 91] },
    });
  if (card.paymentHistory?.length)
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 12,
      head: [["Fecha de pago", "Valor", "Aumentó el cupo", "Ajuste efectivo"]],
      body: card.paymentHistory.map((payment) => [
        payment.date,
        money(payment.amount),
        payment.availableApplied ? "Sí" : "No",
        money(payment.availableChange),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 110, 91] },
    });
  doc.save(`${filename(card)}.pdf`);
}
