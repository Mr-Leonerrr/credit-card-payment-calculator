import { useEffect, useState } from "react";
import { project } from "../features/calculator/model/calculator.js";
import {
  loadWorkspace,
  newCard,
  STORAGE_KEY,
} from "../features/cards/services/storage.js";
import {
  exportCSV,
  exportPDF,
} from "../features/calculator/services/exports.js";
import { blankPurchase } from "../features/purchases/model/purchase.js";
import {
  adjustAvailableCredit,
  increaseAvailableCredit,
  reduceAvailableCredit,
} from "../features/cards/model/credit.js";
import { useAuth } from "../features/auth/hooks/useAuth.js";
import {
  useCloudWorkspace,
  clearAccountCache,
} from "../features/sync/index.js";
import { supabase } from "../lib/supabase.js";
import { readTheme, saveTheme } from "./theme.js";

export function useWorkspace() {
  const [loaded] = useState(() => loadWorkspace());
  const [theme, setTheme] = useState(() => readTheme(loaded.data.theme));
  const [guestWorkspace, setGuestWorkspace] = useState(loaded.data);
  const [storageBlocked, setStorageBlocked] = useState(Boolean(loaded.blocked));
  const auth = useAuth();
  const cloud = useCloudWorkspace(auth.user);
  const workspace = { ...(auth.user ? cloud.workspace : guestWorkspace), theme };
  const canEdit =
    !auth.loading && (auth.user ? cloud.canEdit : !storageBlocked);
  const setWorkspace = (update) => {
    if (auth.user) return cloud.setWorkspace(update);
    if (!canEdit) return false;
    setGuestWorkspace(update);
    return true;
  };
  const [notice, setNotice] = useState(loaded.notice);
  const [saveError, setSaveError] = useState("");
  const [tab, setTab] = useState("overview");
  const [draft, setDraft] = useState(blankPurchase);
  const [editing, setEditing] = useState(null);
  const [creatingCard, setCreatingCard] = useState(false);
  const [cardName, setCardName] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const card =
    workspace.cards.find((item) => item.id === workspace.activeId) ||
    workspace.cards[0];
  const calculation = project(card, workspace.horizon);
  const current = calculation.rows[0];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (storageBlocked || auth.user || auth.loading) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guestWorkspace));
      setSaveError("");
    } catch {
      setSaveError(
        "No se pudo guardar. El almacenamiento está lleno o deshabilitado; exporta tus datos antes de cerrar.",
      );
    }
  }, [guestWorkspace, storageBlocked, auth.user, auth.loading]);

  useEffect(() => {
    setEditing(null);
    setCreatingCard(false);
    setConfirmation(null);
    setDraft(blankPurchase());
    setNotice("");
    setSaveError("");
  }, [auth.user?.id]);

  const updateCard = (changes) =>
    setWorkspace((previous) => ({
      ...previous,
      cards: previous.cards.map((item) =>
        item.id === card.id ? { ...item, ...changes } : item,
      ),
    }));
  const fieldChange = (field) => (value) => updateCard({ [field]: value });
  const setAvailableCredit = (value) =>
    updateCard({
      availableCredit: value,
      purchases: card.purchases.map((purchase) => ({
        ...purchase,
        creditImpact: false,
      })),
      paymentHistory: card.paymentHistory.map((payment) => ({
        ...payment,
        availableApplied: false,
        availableChange: "0",
      })),
    });
  const selectCard = (id) => {
    setWorkspace((previous) => ({ ...previous, activeId: id }));
    setDraft(blankPurchase());
    setEditing(null);
  };
  const addPurchase = (event) => {
    event.preventDefault();
    if (!canEdit) return;
    const affectsCredit =
      draft.entryMode !== "statement" && card.availableCredit !== "";
    if (
      affectsCredit &&
      Number(draft.amount) > Number(card.availableCredit)
    ) {
      setNotice("La compra supera el cupo disponible registrado.");
      return;
    }
    updateCard({
      ...(affectsCredit
        ? { availableCredit: reduceAvailableCredit(card.availableCredit, draft.amount) }
        : {}),
      purchases: [
        ...card.purchases,
        {
          ...draft,
          description: draft.description.trim() || "Compra",
          creditImpact: affectsCredit,
        },
      ],
    });
    setDraft({
      ...blankPurchase(),
      entryMode: draft.entryMode,
      rateOverrideType: draft.rateOverrideType,
      statementNextDate: draft.statementNextDate,
    });
    setNotice("Compra agregada a la lista.");
  };
  const savePurchase = (event) => {
    event.preventDefault();
    if (!canEdit) return;
    const existing = card.purchases.find((purchase) => purchase.id === editing.id);
    const tracked = existing?.creditImpact === true;
    const creditDelta = tracked
      ? Number(existing.amount) -
        (editing.entryMode === "purchase" ? Number(editing.amount) : 0)
      : 0;
    if (
      card.availableCredit !== "" &&
      creditDelta < 0 &&
      -creditDelta > Number(card.availableCredit)
    ) {
      setNotice("El cambio supera el cupo disponible registrado.");
      return;
    }
    updateCard({
      ...(tracked && card.availableCredit !== ""
        ? {
            availableCredit: adjustAvailableCredit(
              card.availableCredit,
              creditDelta,
              card.creditLimit,
            ),
          }
        : {}),
      purchases: card.purchases.map((purchase) =>
        purchase.id === editing.id
          ? {
              ...editing,
              creditImpact:
                tracked && editing.entryMode === "purchase",
              description: editing.description.trim() || "Compra",
            }
          : purchase,
      ),
    });
    setEditing(null);
    setNotice("Compra actualizada.");
  };
  const removePurchase = (purchaseId) => {
    const purchase = card.purchases.find((item) => item.id === purchaseId);
    if (!purchase || !canEdit) return;
    updateCard({
      ...(purchase.creditImpact && card.availableCredit !== ""
        ? {
            availableCredit: adjustAvailableCredit(
              card.availableCredit,
              Number(purchase.amount),
              card.creditLimit,
            ),
          }
        : {}),
      purchases: card.purchases.filter((item) => item.id !== purchaseId),
    });
  };
  const recordPayment = ({ amount, date }) => {
    const paymentAmount = Number(amount);
    if (!canEdit || !Number.isFinite(paymentAmount) || paymentAmount <= 0)
      return false;
    const updatedAvailable =
      card.availableCredit === ""
        ? ""
        : increaseAvailableCredit(
            card.availableCredit,
            paymentAmount,
            card.creditLimit,
          );
    const availableChange =
      updatedAvailable === ""
        ? 0
        : Number(updatedAvailable) - Number(card.availableCredit);
    const availableApplied = availableChange > 0;
    updateCard({
      payments: String(Number((Number(card.payments || 0) + paymentAmount).toFixed(2))),
      availableCredit: updatedAvailable === "" ? card.availableCredit : updatedAvailable,
      paymentHistory: [
        ...card.paymentHistory,
        {
          id: crypto.randomUUID(),
          date,
          amount: String(paymentAmount),
          availableApplied,
          availableChange: String(Math.max(0, availableChange)),
        },
      ],
    });
    setNotice(
      availableApplied
        ? "Pago registrado y cupo disponible actualizado."
        : "Pago registrado. Ingresa el cupo disponible para actualizarlo con futuros pagos.",
    );
    return true;
  };
  const removePayment = (paymentId) => {
    const payment = card.paymentHistory.find((item) => item.id === paymentId);
    if (!payment || !canEdit) return;
    updateCard({
      payments: String(
        Number(
          Math.max(0, Number(card.payments || 0) - Number(payment.amount)).toFixed(2),
        ),
      ),
      ...(payment.availableApplied && card.availableCredit !== ""
        ? {
            availableCredit: adjustAvailableCredit(
              card.availableCredit,
              -Number(payment.availableChange || 0),
            ),
          }
        : {}),
      paymentHistory: card.paymentHistory.filter(
        (item) => item.id !== paymentId,
      ),
    });
    setNotice("Pago eliminado y valores actualizados.");
  };
  const addCard = (event) => {
    event.preventDefault();
    if (!canEdit) return;
    const added = newCard(cardName.trim() || "Mi tarjeta");
    setWorkspace((previous) => ({
      ...previous,
      cards: [...previous.cards, added],
      activeId: added.id,
    }));
    setCreatingCard(false);
    setCardName("");
    setDraft(blankPurchase());
    setTab("settings");
  };
  const removeCard = () => {
    if (!canEdit) return;
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

  const logout = async () => {
    const userId = auth.user?.id;
    await auth.signOut();
    if (userId && !(await supabase.auth.getSession()).data.session)
      clearAccountCache(userId);
  };
  const requestLogout = () => {
    if (cloud.dirty || cloud.status === "saving") {
      setConfirmation({
        title: "¿Salir con cambios sin guardar?",
        text: "Exporta los datos antes de salir. Los cambios no confirmados podrían perderse.",
        action: logout,
      });
    } else void logout();
  };
  const requestReload = () => {
    if (cloud.dirty)
      setConfirmation({
        title: "¿Cargar la versión guardada?",
        text: "Se descartarán los cambios locales sin confirmar. Puedes exportarlos antes de continuar.",
        action: cloud.reload,
      });
    else void cloud.reload();
  };
  const requestImport = () =>
    setConfirmation({
      title: "¿Importar los cálculos locales?",
      text: `Se agregarán a la cuenta ${auth.user?.email || "actual"}. No se borrarán los originales ni se reemplazarán los cálculos de la nube.`,
      action: () => cloud.importLocal(true),
    });
  const requestDiscard = () => {
    if (!cloud.dirty || cloud.status === "saving") return;
    setConfirmation({
      title: "¿Descartar los cambios?",
      text: "Se restaurarán los cálculos de la última versión confirmada. No se modificarán los datos locales de invitado ni se enviarán cambios a la nube.",
      action: () => {
        if (cloud.discard()) {
          setEditing(null);
          setCreatingCard(false);
          setDraft(blankPurchase());
          setNotice("Cambios descartados.");
        }
      },
    });
  };

  return {
    auth,
    cloud,
    configured: Boolean(supabase),
    canEdit,
    requestLogout,
    requestReload,
    requestImport,
    requestDiscard,
    workspace,
    setWorkspace,
    toggleTheme: () => setTheme((previous) => previous === "dark" ? "light" : "dark"),
    notice,
    setNotice,
    saveError,
    storageBlocked: !auth.user && storageBlocked,
    setStorageBlocked,
    tab,
    setTab,
    draft,
    setDraft,
    editing,
    setEditing,
    creatingCard,
    setCreatingCard,
    cardName,
    setCardName,
    confirmation,
    setConfirmation,
    card,
    calculation,
    current,
    updateCard,
    fieldChange,
    setAvailableCredit,
    selectCard,
    addPurchase,
    savePurchase,
    removePurchase,
    recordPayment,
    removePayment,
    addCard,
    removeCard,
    exportCalculation,
  };
}
