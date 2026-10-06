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

export function useWorkspace() {
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
  const card =
    workspace.cards.find((item) => item.id === workspace.activeId) ||
    workspace.cards[0];
  const calculation = project(card, workspace.horizon);
  const current = calculation.rows[0];

  useEffect(() => {
    document.documentElement.dataset.theme = workspace.theme;
    if (storageBlocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
      setSaveError("");
    } catch {
      setSaveError(
        "No se pudo guardar. El almacenamiento está lleno o deshabilitado; exporta tus datos antes de cerrar.",
      );
    }
  }, [workspace, storageBlocked]);

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

  return {
    workspace,
    setWorkspace,
    notice,
    setNotice,
    saveError,
    storageBlocked,
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
