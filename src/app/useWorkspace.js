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
import { useAuth } from "../features/auth/hooks/useAuth.js";
import {
  useCloudWorkspace,
  clearAccountCache,
} from "../features/sync/index.js";
import { supabase } from "../lib/supabase.js";

export function useWorkspace() {
  const [loaded] = useState(() => loadWorkspace());
  const [guestWorkspace, setGuestWorkspace] = useState(loaded.data);
  const [storageBlocked, setStorageBlocked] = useState(Boolean(loaded.blocked));
  const auth = useAuth();
  const cloud = useCloudWorkspace(auth.user);
  const workspace = auth.user ? cloud.workspace : guestWorkspace;
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
    document.documentElement.dataset.theme = workspace.theme;
  }, [workspace.theme]);

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
  const selectCard = (id) => {
    setWorkspace((previous) => ({ ...previous, activeId: id }));
    setDraft(blankPurchase());
    setEditing(null);
  };
  const addPurchase = (event) => {
    event.preventDefault();
    if (!canEdit) return;
    updateCard({
      purchases: [
        ...card.purchases,
        { ...draft, description: draft.description.trim() || "Compra" },
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
    updateCard({
      purchases: card.purchases.map((purchase) =>
        purchase.id === editing.id
          ? { ...editing, description: editing.description.trim() || "Compra" }
          : purchase,
      ),
    });
    setEditing(null);
    setNotice("Compra actualizada.");
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

  return {
    auth,
    cloud,
    configured: Boolean(supabase),
    canEdit,
    requestLogout,
    requestReload,
    requestImport,
    workspace,
    setWorkspace,
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
    selectCard,
    addPurchase,
    savePurchase,
    addCard,
    removeCard,
    exportCalculation,
  };
}
