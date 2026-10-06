import React, { useEffect, useId, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { NumericFormat } from "react-number-format";
import { CreditCard, Plus, Moon, Sun, FileDown, Download, Pencil, Trash2, X, Check,
  Wallet, CalendarDays, ChartNoAxesCombined, Settings2, ReceiptText, ArrowUpRight, ShieldCheck } from "lucide-react";
import { integer, money, monthlyRate, project, purchaseBalance, today } from "./calculator.js";
import { loadWorkspace, newCard, STORAGE_KEY } from "./storage.js";
import { exportCSV, exportPDF } from "./exports.js";
import { FieldLabel } from "./FieldHelp.jsx";
import "./index.css";

const dateLabel = (date) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
const blankPurchase = () => ({ id: crypto.randomUUID(), description: "", amount: "", installments: "1", paidInstallments: "0", date: today(), rateOverride: "",
  entryMode: "purchase", processDate: "", statementBalance: "", statementRemaining: "1", statementCapital: "", statementNextDate: "", rateOverrideType: "monthly" });

function App() {
  const [loaded] = useState(() => loadWorkspace());
  const [workspace, setWorkspace] = useState(loaded.data);
  const [notice, setNotice] = useState(loaded.notice);
  const [saveError, setSaveError] = useState("");
  const [storageBlocked, setStorageBlocked] = useState(Boolean(loaded.blocked));
  const [tab, setTab] = useState("overview");
  const [draft, setDraft] = useState(blankPurchase);
  const [editing, setEditing] = useState(null);
  const [creatingCard, setCreatingCard] = useState(false);
  const [cardName, setCardName] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const card = workspace.cards.find((item) => item.id === workspace.activeId) || workspace.cards[0];
  const calculation = project(card, workspace.horizon);
  const current = calculation.rows[0];

  useEffect(() => {
    document.documentElement.dataset.theme = workspace.theme;
    if (storageBlocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      setSaveError("");
    } catch {
      setSaveError("No se pudo guardar. El almacenamiento está lleno o deshabilitado; exporta tus datos antes de cerrar.");
    }
  }, [workspace, storageBlocked]);

  const updateCard = (changes) => setWorkspace((previous) => ({ ...previous,
    cards: previous.cards.map((item) => item.id === card.id ? { ...item, ...changes } : item),
  }));
  const fieldChange = (field) => (value) => updateCard({ [field]: value });
  const selectCard = (id) => {
    setWorkspace((previous) => ({ ...previous, activeId: id }));
    setDraft(blankPurchase());
    setEditing(null);
  };
  const addPurchase = (event) => {
    event.preventDefault();
    updateCard({ purchases: [...card.purchases, { ...draft, description: draft.description.trim() || "Compra" }] });
    setDraft({ ...blankPurchase(), entryMode: draft.entryMode, rateOverrideType: draft.rateOverrideType, statementNextDate: draft.statementNextDate });
    setNotice("Compra agregada a la lista.");
  };
  const savePurchase = (event) => {
    event.preventDefault();
    updateCard({ purchases: card.purchases.map((purchase) => purchase.id === editing.id ? { ...editing, description: editing.description.trim() || "Compra" } : purchase) });
    setEditing(null);
    setNotice("Compra actualizada.");
  };
  const addCard = (event) => {
    event.preventDefault();
    const added = newCard(cardName.trim() || "Mi tarjeta");
    setWorkspace((previous) => ({ ...previous, cards: [...previous.cards, added], activeId: added.id }));
    setCreatingCard(false);
    setCardName("");
    setDraft(blankPurchase());
    setTab("settings");
  };
  const removeCard = () => {
    setWorkspace((previous) => {
      const remaining = previous.cards.filter((item) => item.id !== card.id);
      if (!remaining.length) remaining.push(newCard());
      return { ...previous, cards: remaining, activeId: remaining[0].id };
    });
    setDraft(blankPurchase());
    setNotice("Tarjeta eliminada.");
  };
  const exportCalculation = async (type) => {
    try {
      await (type === "pdf" ? exportPDF : exportCSV)(card, calculation);
      setNotice(`Exportación ${type.toUpperCase()} generada.`);
    } catch {
      setNotice("No fue posible generar el archivo. Intenta nuevamente.");
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-icon"><CreditCard size={22} /></span><span>Mi corte<span className="brand-subtitle">Finanzas personales</span></span></a>
        <div className="topbar-actions"><span className="local-badge"><ShieldCheck size={15} /> Datos locales</span>
          <IconButton label={workspace.theme === "light" ? "Activar modo oscuro" : "Activar modo claro"} onClick={() => setWorkspace((previous) => ({ ...previous, theme: previous.theme === "light" ? "dark" : "light" }))}>
            {workspace.theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
          </IconButton>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading"><h2>Mis tarjetas</h2><IconButton label="Agregar tarjeta" onClick={() => setCreatingCard(true)}><Plus size={18} /></IconButton></div>
          <nav className="card-nav" aria-label="Tarjetas guardadas">
            {workspace.cards.map((item, index) => <button key={item.id} className={`card-selector ${item.id === card.id ? "active" : ""}`} aria-pressed={item.id === card.id} onClick={() => selectCard(item.id)}>
              <CreditCard size={22} /><span><strong>{item.name}</strong><small>Tarjeta {String(index + 1).padStart(2, "0")} · COP</small></span>{item.id === card.id && <span className="selected-dot" />}
            </button>)}
          </nav>
          <div className="sidebar-footer"><ShieldCheck size={17} /><p>Guardado en este navegador.<br />Sin números de tarjeta ni datos bancarios.</p></div>
        </aside>
        <main className="main-content">
          <div className="page-heading"><div><p className="eyebrow">ESTADO ESTIMADO</p><h1>{card.name}</h1><p className="muted"><CalendarDays size={15} /> Próximo corte: {dateLabel(current.date)}</p></div>
            <div className="export-actions"><button className="button secondary" onClick={() => exportCalculation("csv")}><Download size={16} /> CSV</button><button className="button secondary" onClick={() => exportCalculation("pdf")}><FileDown size={16} /> PDF</button></div>
          </div>
          {(notice || saveError) && <div className={`notice ${saveError ? "error" : ""}`} role="status"><span>{saveError || notice}</span>{!saveError && <IconButton label="Cerrar aviso" onClick={() => setNotice("")}><X size={16} /></IconButton>}</div>}
          {storageBlocked && <div className="notice error"><span>El guardado está pausado para conservar los datos originales.</span><button className="button secondary" onClick={() => setConfirmation({ title: "¿Reemplazar los datos guardados?", text: "Los datos anteriores no se pudieron leer. Se reemplazarán por las tarjetas actuales.", action: () => { setStorageBlocked(false); setNotice(""); } })}>Guardar datos nuevos</button></div>}
          <nav className="tabs" aria-label="Vistas de la tarjeta">
            {[{ id: "overview", label: "Resumen", icon: Wallet }, { id: "projection", label: "Proyección", icon: ChartNoAxesCombined }, { id: "settings", label: "Configuración", icon: Settings2 }].map(({ id, label, icon: Icon }) => <button key={id} aria-current={tab === id ? "page" : undefined} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={17} />{label}</button>)}
          </nav>
          {tab === "overview" && <>
            <div className="balance-strip"><Metric label="Cupo total de la tarjeta" value={card.creditLimit === "" ? null : card.creditLimit} /><Metric label="Cupo actual disponible" value={card.availableCredit === "" ? null : card.availableCredit} /><Metric label="Pago total pendiente estimad" value={calculation.totalPending} /></div>
            <div className="balance-strip"><Metric label="Capital pendiente total" value={calculation.previousBalance + calculation.purchaseBalance} /><Metric label="Saldo de compras anteriores" value={calculation.previousBalance} /><Metric label="Capital de cuotas pendientes" value={calculation.purchaseBalance} /></div>
            <div className="overview-grid"><div className="overview-body">
              <section className="section"><SectionHeading icon={CreditCard} title="Cupo de la tarjeta" /><div className="field-grid two">
                <Field label="Cupo total de la tarjeta" type="number" min="0" step="0.01" value={card.creditLimit} onChange={fieldChange("creditLimit")} prefix="$" placeholder="Sin registrar" />
                <Field label="Cupo actual disponible" type="number" min="0" step="0.01" value={card.availableCredit} onChange={fieldChange("availableCredit")} prefix="$" placeholder="Sin registrar" />
              </div><p className="disclosure">Cupos informados por tu banco. Se guardan por tarjeta y no se modifican automáticamente con las compras o los abonos.</p>
                {card.creditLimit !== "" && card.availableCredit !== "" && Number(card.availableCredit) > Number(card.creditLimit) && <p className="disclosure interest-text" role="status">El cupo disponible supera el cupo total. Revisa los valores registrados.</p>}
              </section>
              <section className="section"><SectionHeading icon={Wallet} title="Saldo anterior y abonos" /><div className="field-grid three">
                <Field label="Saldo anterior (sin cuotas registradas)" type="number" min="0" step="0.01" value={card.previousBalance} onChange={fieldChange("previousBalance")} prefix="$" />
                <Field label="Cargos adicionales de este corte" type="number" min="0" step="0.01" value={card.extraCharges} onChange={fieldChange("extraCharges")} prefix="$" />
                <Field label="Abonos para este corte" type="number" min="0" step="0.01" value={card.payments} onChange={fieldChange("payments")} prefix="$" />
              </div><details className="assumptions"><summary>Condiciones del cálculo</summary><p>El saldo anterior es capital no registrado en la lista de compras. No lo ingreses dos veces. Los abonos se descuentan solo del próximo corte; el exceso reduce primero el saldo anterior y después las compras. Las cuotas pagadas deben reflejar los pagos de cortes anteriores.</p></details></section>
              <section className="section purchase-entry"><SectionHeading icon={Plus} title="Agregar movimiento" /><form onSubmit={addPurchase}><PurchaseFields purchase={draft} onChange={setDraft} nextDate={current.date} /><div className="form-actions"><button className="button primary" type="submit"><Plus size={17} /> Agregar compra</button></div></form></section>
              <section className="section"><div className="section-heading"><h2><ReceiptText size={19} /> Compras registradas</h2><span className="count">{card.purchases.length}</span></div>
                {!card.purchases.length ? <div className="empty-state"><ReceiptText size={32} strokeWidth={1.3} /><p>No hay compras registradas</p></div> : <div className="purchase-list">{card.purchases.map((purchase) => {
                  const total = Number(purchase.installments);
                  const paid = Number(purchase.paidInstallments);
                  const fromStatement = purchase.entryMode === "statement";
                  const pending = fromStatement ? Number(purchase.statementRemaining) : total - paid;
                  const detail = current.details.find((item) => item.id === purchase.id);
                  return <article className="purchase-row" key={purchase.id}>
                    <div className={`purchase-symbol ${total === 1 ? "single" : ""}`}><ReceiptText size={19} /></div>
                    <div className="purchase-info"><strong>{purchase.description}</strong><span>{dateLabel(purchase.date)} · {total === 1 ? "Una cuota" : `${total} cuotas`}</span><span className="purchase-status">{fromStatement ? `${pending} pendientes · Extracto` : paid === total ? "Pagada" : `${paid} pagadas · ${pending} pendientes`}</span><progress aria-label={`${fromStatement ? "Avance del plazo" : "Cuotas pagadas"} de ${purchase.description}`} max={total} value={total - pending} /></div>
                    <div className="purchase-amount"><strong>{money(purchaseBalance(purchase))}</strong><span>Capital pendiente</span><small>Próximo corte: {money(detail ? detail.capital + detail.interest : 0)}</small></div>
                    <div className="row-actions"><IconButton label={`Editar ${purchase.description}`} onClick={() => setEditing({ ...purchase })}><Pencil size={16} /></IconButton><IconButton label={`Eliminar ${purchase.description}`} danger onClick={() => setConfirmation({ title: "¿Eliminar compra?", text: purchase.description, action: () => updateCard({ purchases: card.purchases.filter((item) => item.id !== purchase.id) }) })}><Trash2 size={16} /></IconButton></div>
                  </article>;
                })}</div>}
              </section>
            </div><aside className="statement"><div className="statement-header"><span>Pago mínimo estimado</span><strong>{money(current.minimum)}</strong><span>{dateLabel(current.date)}</span></div><div className="statement-body">
              <SummaryRow label="Capital del saldo anterior" value={current.previousCapital} /><SummaryRow label="Capital de compras" value={current.purchaseCapital} /><SummaryRow label="Intereses" value={current.interest} accent /><SummaryRow label="Cargos" value={current.charges} /><SummaryRow label="Abonos registrados" value={card.payments} negative />
              <div className="statement-total"><span>Pago total al corte</span><strong>{money(current.totalPayment)}</strong></div>
              <div className="statement-total general-total"><span>Pago total pendiente estimad</span><strong>{calculation.totalPending == null ? "Sin registrar" : money(calculation.totalPending)}</strong></div>
              <div className="composition" role="img" aria-label={`Capital ${money(current.capital)}, intereses ${money(current.interest)}, cargos ${money(current.charges)}`}><div className="composition-bar"><span style={{ flex: current.capital }} /><span style={{ flex: current.interest }} /><span style={{ flex: current.charges }} /></div><Legend /></div>
              <p className="statement-note">Pago total: capital facturable e intereses de este corte, menos abonos. No incluye compras con primer corte futuro.</p>
              <p className="statement-note">Pago total pendiente: cupo total de la tarjeta menos cupo actual disponible, según los valores informados por tu banco. No se suman nuevamente compras, intereses, cargos ni abonos.</p>
              {current.unappliedPayment > 0 && <p className="statement-note">Abono excedente no aplicado: {money(current.unappliedPayment)}.</p>}
              <button className="button text-button" onClick={() => setTab("projection")}>Ver proyección <ArrowUpRight size={16} /></button>
            </div></aside></div>
          </>}
          {tab === "projection" && <section className="projection-view"><div className="section-heading"><h2><ChartNoAxesCombined size={20} /> Próximos cortes</h2><div className="segmented" aria-label="Meses de proyección">{[3, 6, 12].map((months) => <button key={months} aria-pressed={workspace.horizon === months} className={workspace.horizon === months ? "active" : ""} onClick={() => setWorkspace((previous) => ({ ...previous, horizon: months }))}>{months} meses</button>)}</div></div>
            <div className="balance-strip"><Metric label="Pagos mínimos por realizar" value={calculation.totalMinimum} /><Metric label="Intereses proyectados" value={calculation.totalInterest} /><Metric label="Capital al final del período" value={calculation.rows.at(-1).remaining} /></div><ProjectionChart rows={calculation.rows} />
            <div className="table-scroll"><table><caption>Proyección de pagos en pesos colombianos</caption><thead><tr><th>Corte</th><th>Capital anterior</th><th>Capital compras</th><th>Intereses</th><th>Cargos</th><th>Abonos</th><th>Pago mínimo</th><th>Capital restante</th></tr></thead><tbody>{calculation.rows.map((row) => <tr key={row.date}><th scope="row">{dateLabel(row.date)}</th><td>{money(row.previousCapital)}</td><td>{money(row.purchaseCapital)}</td><td className="interest-text">{money(row.interest)}</td><td>{money(row.charges)}</td><td>{money(row.payment)}</td><td className="strong">{money(row.minimum)}</td><td>{money(row.remaining)}</td></tr>)}</tbody></table></div>
            <p className="disclosure">Supuesto: pagas el mínimo estimado en cada corte, sin compras ni abonos nuevos. Los abonos registrados solo afectan el primer mes. El capital restante no incluye intereses futuros ni cargos.</p>
          </section>}
          {tab === "settings" && <section className="settings-view"><SectionHeading icon={Settings2} title="Condiciones de la tarjeta" /><div className="field-grid settings-grid">
            <Field label="Nombre de la tarjeta" maxLength={80} value={card.name} onChange={fieldChange("name")} />
            <Field label="Fecha de cálculo" type="date" value={card.referenceDate} onChange={(value) => { if (value && !Number.isNaN(Date.parse(value))) updateCard({ referenceDate: value }); }} />
            <Field label="Día de corte" type="number" min="1" max="31" step="1" value={card.cutoffDay} onChange={(value) => updateCard({ cutoffDay: String(integer(value, 1, 31)) })} />
            <Field label="Tasa de interés (%)" type="number" min="0" max={card.rateType === "annual" ? "1000" : "100"} step="0.001" value={card.rate} onChange={fieldChange("rate")} />
            <div className="field"><FieldLabel label="Tipo de tasa" inputId="rate-type" /><select id="rate-type" aria-describedby="rate-type-help" value={card.rateType} onChange={(event) => updateCard({ rateType: event.target.value })}><option value="monthly">Mensual vencida (MV)</option><option value="annual">Efectiva anual (EA)</option></select></div>
            <div className="rate-equivalent"><span>Tasa mensual equivalente</span><strong>{(monthlyRate(card) * 100).toFixed(2)}%</strong></div>
            <Field label="Capital mínimo del saldo anterior (%)" type="number" min="0" max="100" step="0.1" value={card.minimumPercent} onChange={fieldChange("minimumPercent")} />
            <Field label="Piso de capital del saldo anterior" type="number" min="0" step="0.01" value={card.minimumFloor} onChange={fieldChange("minimumFloor")} prefix="$" />
            <Field label="Cargos mensuales (manejo, seguro, etc.)" type="number" min="0" step="0.01" value={card.recurringCharges} onChange={fieldChange("recurringCharges")} prefix="$" />
          </div><div className="toggle-row"><div><FieldLabel label="Compras a una cuota sin intereses" inputId="interest-free-single" /><small>Según las condiciones de tu entidad</small></div><input id="interest-free-single" aria-describedby="interest-free-single-help" type="checkbox" role="switch" checked={card.interestFreeSingle} onChange={(event) => updateCard({ interestFreeSingle: event.target.checked })} /></div>
          <div className="model-disclosure"><h3>Modelo de estimación</h3><p>Compras diferidas: capital constante (valor ÷ cuotas) e interés mensual sobre el capital pendiente. Saldo anterior: el mayor entre el porcentaje y el piso configurados, limitado al saldo disponible, más sus intereses. Se suman las cuotas exigibles y los cargos. El 5% inicial es un supuesto editable, no una regla bancaria.</p><p>Una compra realizada el día de corte se incluye en ese corte. Los meses cortos usan su último día. La próxima cuota es la primera no pagada, pero nunca se proyecta antes de la fecha de cálculo. No se estiman cuotas vencidas, mora ni intereses diarios.</p></div>
          <div className="danger-zone"><div><h3>Eliminar tarjeta</h3><p>Se eliminarán también sus compras y condiciones.</p></div><button className="button danger" onClick={() => setConfirmation({ title: "¿Eliminar esta tarjeta?", text: `Se eliminarán ${card.name} y todas sus compras. Esta acción no se puede deshacer.`, action: removeCard })}><Trash2 size={16} /> Eliminar</button></div></section>}
          <footer className="app-footer">Estimación orientativa, no un extracto bancario. Los intereses, el pago mínimo y la fecha de contabilización dependen de tu entidad.</footer>
        </main>
      </div>
      {editing && <Modal title="Editar compra" onClose={() => setEditing(null)}><form onSubmit={savePurchase}><PurchaseFields purchase={editing} onChange={setEditing} editing nextDate={current.date} /><div className="form-actions"><button className="button secondary" type="button" onClick={() => setEditing(null)}>Cancelar</button><button className="button primary" type="submit"><Check size={17} /> Guardar cambios</button></div></form></Modal>}
      {creatingCard && <Modal title="Nueva tarjeta" onClose={() => setCreatingCard(false)}><form onSubmit={addCard}><Field label="Nombre" value={cardName} onChange={setCardName} required maxLength={80} placeholder="Ej. Tarjeta principal" /><div className="form-actions"><button type="submit" className="button primary"><Plus size={17} /> Crear tarjeta</button></div></form></Modal>}
      {confirmation && <Modal title={confirmation.title} onClose={() => setConfirmation(null)}><p className="confirmation-text">{confirmation.text}</p><div className="form-actions"><button className="button secondary" onClick={() => setConfirmation(null)}>Cancelar</button><button className="button danger" onClick={() => { confirmation.action(); setConfirmation(null); }}>Confirmar</button></div></Modal>}
    </div>
  );
}

function PurchaseFields({ purchase, onChange, editing = false, nextDate }) {
  const fromStatement = purchase.entryMode === "statement";
  const change = (field, value) => onChange((previous) => {
    const updated = { ...previous, [field]: value };
    if (field === "installments" && value !== "") {
      updated.paidInstallments = String(Math.min(integer(previous.paidInstallments, 0, 120), integer(value)));
      updated.statementRemaining = String(Math.min(integer(previous.statementRemaining ?? 1, 0, 120), integer(value)));
    }
    if (field === "entryMode") {
      updated.rateOverride = "";
      updated.rateOverrideType = value === "statement" ? "annual" : "monthly";
      updated.statementNextDate = previous.statementNextDate || nextDate;
    }
    return updated;
  });
  const total = integer(purchase.installments);
  const paid = integer(purchase.paidInstallments, 0, total);
  return <div className="purchase-fields">
    <div className="segmented purchase-mode" aria-label="Origen del movimiento"><button type="button" aria-pressed={!fromStatement} className={!fromStatement ? "active" : ""} onClick={() => change("entryMode", "purchase")}>Nueva compra</button><button type="button" aria-pressed={fromStatement} className={fromStatement ? "active" : ""} onClick={() => change("entryMode", "statement")}>Desde extracto</button></div>
    {!fromStatement && <div className="segmented purchase-mode" aria-label="Tipo de compra"><button type="button" aria-pressed={total === 1} className={total === 1 ? "active" : ""} onClick={() => change("installments", "1")}>Una cuota</button><button type="button" aria-pressed={total > 1} className={total > 1 ? "active" : ""} onClick={() => change("installments", "3")}>Diferida</button></div>}
    <div className="field-grid two">
    <Field label="Descripción" value={purchase.description} onChange={(value) => change("description", value)} required maxLength={120} placeholder="Ej. Mercado" />
    <Field label={fromStatement ? "Valor compra del extracto" : "Valor original de la compra"} type="number" min="0.01" max="1000000000000" step="0.01" value={purchase.amount} onChange={(value) => change("amount", value)} prefix="$" required />
    <Field label={fromStatement ? "Fecha de transacción" : "Fecha de compra"} type="date" value={purchase.date} onChange={(value) => change("date", value)} required />
    {fromStatement && <Field label="Fecha de proceso (opcional)" type="date" value={purchase.processDate || ""} onChange={(value) => change("processDate", value)} />}
    <Field label={fromStatement ? "Plazo del extracto" : "Cuotas totales"} type="number" min="1" max="120" step="1" value={purchase.installments} onChange={(value) => change("installments", value)} required />
    {fromStatement ? <>
      <Field label="Cuotas pendientes del extracto" type="number" min={Number(purchase.statementBalance) > 0 ? "1" : "0"} max={total} step="1" clampOnBlur={false} value={purchase.statementRemaining ?? "1"} onChange={(value) => change("statementRemaining", value)} required />
      <Field label="Saldo pendiente del extracto" type="number" min={Number(purchase.statementRemaining) > 0 ? "0.01" : "0"} step="0.01" clampOnBlur={false} value={purchase.statementBalance ?? ""} onChange={(value) => change("statementBalance", value)} prefix="$" required />
      <Field label="Valor cuota mes (solo capital, opcional)" type="number" min="0.01" step="0.01" value={purchase.statementCapital ?? ""} onChange={(value) => change("statementCapital", value)} prefix="$" placeholder="Saldo dividido entre pendientes" />
      <Field label="Tasa E.A. del extracto (%)" type="number" min="0" max="1000" step="0.001" value={purchase.rateOverride} onChange={(value) => change("rateOverride", value)} placeholder="Tasa de la tarjeta" />
      <Field label="Primer corte a proyectar" type="date" min={nextDate} value={purchase.statementNextDate || nextDate} onChange={(value) => change("statementNextDate", value)} required />
    </> : <>
      <Field label="Cuotas pagadas" type="number" min="0" max={total} step="1" value={purchase.paidInstallments} onChange={(value) => change("paidInstallments", value)} required />
      <Field label="Cuotas pendientes" type="number" min="0" max={total} step="1" value={total - paid} onChange={(value) => change("paidInstallments", String(total - integer(value, 0, total)))} required />
      {editing && <Field label="Tasa particular (% MV, opcional)" type="number" min="0" max="100" step="0.001" value={purchase.rateOverride} onChange={(value) => change("rateOverride", value)} placeholder="Tasa de la tarjeta" />}
    </>}
  </div></div>;
}
function Field({ label, value, onChange, prefix, clampOnBlur = true, ...props }) {
  const inputId = useId();
  const moneyRef = useRef(null);
  useEffect(() => {
    if (prefix !== "$") return;
    const belowMinimum = value !== "" && props.min != null && Number(value) < Number(props.min);
    const aboveMaximum = value !== "" && props.max != null && Number(value) > Number(props.max);
    moneyRef.current?.setCustomValidity(belowMinimum || aboveMaximum ? "Ingresa un valor dentro de los límites permitidos." : "");
  }, [value, prefix, props.min, props.max]);
  const normalize = () => {
    if (!clampOnBlur || props.type !== "number" || value === "") return;
    let normalized = Number(value);
    if (!Number.isFinite(normalized)) normalized = Number(props.min || 0);
    if (props.min != null) normalized = Math.max(Number(props.min), normalized);
    if (props.max != null) normalized = Math.min(Number(props.max), normalized);
    if (props.step === "1") normalized = Math.trunc(normalized);
    if (normalized !== Number(value)) onChange(String(normalized));
  };
  const inputProps = { ...props, id: inputId, "aria-describedby": `${inputId}-help`, value, onBlur: normalize };
  return <div className="field"><FieldLabel label={label} inputId={inputId} /><div className={prefix ? "input-wrap with-prefix" : "input-wrap"}>{prefix && <span className="input-prefix" aria-hidden="true">{prefix}</span>}
    {prefix === "$" ? <NumericFormat {...inputProps} type="text" inputMode="decimal" getInputRef={moneyRef}
      valueIsNumericString thousandSeparator="." decimalSeparator="," allowedDecimalSeparators={[","]}
      decimalScale={2} allowNegative={false}
      onValueChange={(values, sourceInfo) => {
        if (sourceInfo.source === "event") onChange(values.value);
      }} /> : <input {...inputProps} onChange={(event) => onChange(event.target.value)} />}
  </div></div>;
}
function IconButton({ label, children, danger, ...props }) {
  return <button type="button" className={`icon-button ${danger ? "danger-icon" : ""}`} aria-label={label} title={label} {...props}>{children}</button>;
}
function SectionHeading({ title, icon: Icon }) {
  return <div className="section-heading"><h2><Icon size={19} />{title}</h2></div>;
}
function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value == null ? "Sin registrar" : money(value)}</strong></div>;
}
function SummaryRow({ label, value, negative, accent }) {
  return <div className={`summary-row ${accent ? "interest-text" : ""}`}><span>{label}</span><strong>{negative && Number(value) > 0 ? "- " : ""}{money(value)}</strong></div>;
}
function Legend() {
  return <div className="legend"><span><i className="capital-dot" />Capital</span><span><i className="interest-dot" />Intereses</span><span><i className="charges-dot" />Cargos</span></div>;
}
function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  const close = (event) => { event.preventDefault(); onClose(); };
  const handleKeyDown = (event) => {
    if (event.key !== "Escape") return;
    if (ref.current.querySelector('[role="tooltip"]')) {
      event.preventDefault();
      return;
    }
    close(event);
  };
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={close} onKeyDown={handleKeyDown}><div className="modal-header"><h2 id="modal-title">{title}</h2><IconButton label="Cerrar ventana" onClick={onClose}><X size={20} /></IconButton></div>{children}</dialog>;
}
function ProjectionChart({ rows }) {
  const maximum = Math.max(1, ...rows.map((row) => row.grossMinimum));
  return <div className="projection-chart"><div className="chart-caption"><span>Composición del pago antes de abonos</span><Legend /></div><div className="chart-bars">{rows.map((row) => <div className="chart-column" key={row.date}><div className="chart-track" role="img" aria-label={`${dateLabel(row.date)}: capital ${money(row.capital)}, intereses ${money(row.interest)}, cargos ${money(row.charges)}`} title={`${dateLabel(row.date)}: ${money(row.grossMinimum)}`}><div className="chart-stack" style={{ height: `${row.grossMinimum / maximum * 100}%` }}><span className="chart-charge" style={{ flex: row.charges }} /><span className="chart-interest" style={{ flex: row.interest }} /><span className="chart-capital" style={{ flex: row.capital }} /></div></div><span className="chart-month">{new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" }).format(new Date(`${row.date}T00:00:00Z`))}</span></div>)}</div></div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
