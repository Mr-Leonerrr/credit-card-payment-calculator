import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const STORAGE_KEY = "tarjeta-cuota-calculador-v1";

const initialState = {
  pendingBalance: "",
  extraCharges: "",
  payments: "",
  purchases: [
    { id: 1, description: "", amount: "", installments: "1", monthlyRate: "0" },
  ],
};

const money = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));

function installmentPayment(principal, installments, monthlyRate) {
  const p = Math.max(0, Number(principal) || 0);
  const n = Math.max(1, Number(installments) || 1);
  const rate = Math.max(0, Number(monthlyRate) || 0) / 100;

  if (!rate) return p / n;

  return (p * rate) / (1 - Math.pow(1 + rate, -n));
}

function App() {
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialState;
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const calculation = useMemo(() => {
    const pending = Math.max(0, Number(form.pendingBalance) || 0);
    const charges = Math.max(0, Number(form.extraCharges) || 0);
    const payments = Math.max(0, Number(form.payments) || 0);

    const purchases = form.purchases.map((purchase) => {
      const amount = Math.max(0, Number(purchase.amount) || 0);
      const installments = Math.max(1, Number(purchase.installments) || 1);
      const monthlyRate = Math.max(0, Number(purchase.monthlyRate) || 0);
      const monthly = installmentPayment(amount, installments, monthlyRate);
      const interestCost = Math.max(0, monthly * installments - amount);

      return {
        ...purchase,
        amount,
        installments,
        monthlyRate,
        monthly,
        interestCost,
      };
    });

    const newPurchases = purchases.reduce((sum, p) => sum + p.monthly, 0);
    const estimatedTotal = Math.max(0, pending + newPurchases + charges - payments);

    return {
      pending,
      charges,
      payments,
      purchases,
      newPurchases,
      estimatedTotal,
    };
  }, [form]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updatePurchase = (id, field, value) => {
    setForm((current) => ({
      ...current,
      purchases: current.purchases.map((purchase) =>
        purchase.id === id ? { ...purchase, [field]: value } : purchase
      ),
    }));
  };

  const addPurchase = () => {
    setForm((current) => ({
      ...current,
      purchases: [
        ...current.purchases,
        {
          id: Date.now(),
          description: "",
          amount: "",
          installments: "1",
          monthlyRate: "0",
        },
      ],
    }));
  };

  const removePurchase = (id) => {
    setForm((current) => ({
      ...current,
      purchases:
        current.purchases.length === 1
          ? current.purchases
          : current.purchases.filter((purchase) => purchase.id !== id),
    }));
  };

  const reset = () => {
    setForm(initialState);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Calculador personal
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            ¿Cuánto pagaré en mi próximo corte?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Ingresa tu saldo pendiente, las compras nuevas y sus cuotas. Obtendrás
            una estimación rápida de lo que podría aparecer en tu próximo estado de cuenta.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle
                number="01"
                title="Saldo actual"
                description="Valores que ya tienes pendientes antes de las compras nuevas."
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <MoneyInput
                  label="Saldo pendiente"
                  value={form.pendingBalance}
                  onChange={(value) => updateField("pendingBalance", value)}
                  hint="Lo que ya debes."
                />
                <MoneyInput
                  label="Intereses / cargos"
                  value={form.extraCharges}
                  onChange={(value) => updateField("extraCharges", value)}
                  hint="Seguros, cuotas u otros."
                />
                <MoneyInput
                  label="Pagos realizados"
                  value={form.payments}
                  onChange={(value) => updateField("payments", value)}
                  hint="Pagos antes del corte."
                />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <SectionTitle
                  number="02"
                  title="Compras nuevas"
                  description="Agrega cada compra realizada desde el último corte."
                />
                <button
                  type="button"
                  onClick={addPurchase}
                  className="shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  + Agregar
                </button>
              </div>

              <div className="space-y-4">
                {form.purchases.map((purchase, index) => (
                  <div
                    key={purchase.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Compra {index + 1}
                      </span>
                      {form.purchases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePurchase(purchase.id)}
                          className="text-xs font-semibold text-slate-500 hover:text-red-600"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field
                        label="Descripción"
                        value={purchase.description}
                        placeholder="Ej. Mercado"
                        onChange={(value) =>
                          updatePurchase(purchase.id, "description", value)
                        }
                      />
                      <MoneyInput
                        label="Monto"
                        value={purchase.amount}
                        onChange={(value) =>
                          updatePurchase(purchase.id, "amount", value)
                        }
                      />
                      <Field
                        label="Número de cuotas"
                        type="number"
                        min="1"
                        step="1"
                        value={purchase.installments}
                        onChange={(value) =>
                          updatePurchase(purchase.id, "installments", value)
                        }
                      />
                      <Field
                        label="Interés mensual %"
                        type="number"
                        min="0"
                        step="0.01"
                        value={purchase.monthlyRate}
                        onChange={(value) =>
                          updatePurchase(purchase.id, "monthlyRate", value)
                        }
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs">
                      <span className="text-slate-500">
                        Cuota estimada:{" "}
                        <strong className="text-slate-800">
                          {money(
                            calculation.purchases.find((p) => p.id === purchase.id)
                              ?.monthly
                          )}
                        </strong>
                      </span>
                      <span className="text-slate-400">
                        Cálculo financiero estimado
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <strong>Importante:</strong> esto es una estimación. El banco puede
              calcular intereses, seguros, impuestos, compras diferidas y redondeos
              con reglas diferentes. Para un resultado exacto hay que usar las
              condiciones de tu tarjeta y el estado de cuenta.
            </div>
          </section>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
              <div className="p-6">
                <p className="text-sm font-medium text-slate-400">
                  Próximo corte estimado
                </p>
                <div className="mt-2 break-words text-4xl font-bold tracking-tight">
                  {money(calculation.estimatedTotal)}
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Incluye el saldo pendiente, la cuota del primer mes de las compras
                  nuevas, cargos y descuentos por pagos registrados.
                </p>
              </div>

              <div className="space-y-3 border-t border-white/10 bg-white/5 p-6 text-sm">
                <SummaryRow label="Saldo pendiente" value={calculation.pending} />
                <SummaryRow label="Cuotas compras nuevas" value={calculation.newPurchases} />
                <SummaryRow label="Intereses / cargos" value={calculation.charges} />
                <SummaryRow
                  label="Pagos realizados"
                  value={-calculation.payments}
                  negative
                />
                <div className="my-2 border-t border-white/10" />
                <div className="flex items-center justify-between gap-4 font-bold">
                  <span>Total estimado</span>
                  <span>{money(calculation.estimatedTotal)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={reset}
                className="m-6 mt-0 w-[calc(100%-3rem)] rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Limpiar cálculo
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
              Tus datos se guardan solamente en este navegador mediante
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5">localStorage</code>.
              No se envían a un servidor.
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ number, title, description }) {
  return (
    <div className="mb-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-bold tracking-widest text-emerald-600">{number}</span>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  step,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <input
        type={type}
        min={min}
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
      />
    </label>
  );
}

function MoneyInput({ label, value, onChange, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
          $
        </span>
        <input
          type="number"
          min="0"
          step="1000"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-7 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          placeholder="0"
        />
      </div>
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

function SummaryRow({ label, value, negative }) {
  return (
    <div className="flex items-center justify-between gap-4 text-slate-300">
      <span>{label}</span>
      <span className={negative ? "text-emerald-300" : "text-white"}>
        {negative && value < 0 ? "− " : ""}
        {money(Math.abs(value))}
      </span>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
