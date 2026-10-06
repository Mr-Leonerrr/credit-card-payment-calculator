export const THEME_STORAGE_KEY = "mi-corte-theme";

export function readTheme(fallback = "light", storage) {
  try {
    const saved = (storage ?? globalThis.localStorage)?.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {}
  return fallback === "dark" ? "dark" : "light";
}

export function saveTheme(theme, storage) {
  try {
    (storage ?? globalThis.localStorage)?.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}
