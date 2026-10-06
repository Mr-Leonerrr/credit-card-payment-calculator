import { createClient } from "@supabase/supabase-js";

const environment = import.meta.env ?? {};
const url = environment.VITE_SUPABASE_URL?.trim() ?? "";
const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

function validateConfiguration() {
  if (!url && !key) return null;
  if (!url || !key) {
    return new Error("Supabase requires a URL and a public publishable key.");
  }
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (
      (parsed.protocol !== "https:" &&
        !(local && parsed.protocol === "http:")) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/"
    ) {
      throw new Error("Invalid URL");
    }
  } catch {
    return new Error(
      "Supabase requires an HTTPS project URL (HTTP is allowed locally).",
    );
  }
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null;
  try {
    const parts = key.split(".");
    if (
      parts.length !== 3 ||
      parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
    ) {
      throw new Error("Invalid key");
    }
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(
      atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")),
    );
    if (claims.role === "anon") return null;
  } catch {
    return new Error(
      "Use only a Supabase publishable key or legacy anon key; secret keys are forbidden.",
    );
  }
  return new Error(
    "Use only a Supabase publishable key or legacy anon key; secret keys are forbidden.",
  );
}

export const configurationError = validateConfiguration();
export const supabase =
  !configurationError && url && key
    ? createClient(url, key, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
