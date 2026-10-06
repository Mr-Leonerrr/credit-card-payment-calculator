import { useEffect, useRef, useState } from "react";
import { configurationError, supabase } from "../../../lib/supabase.js";

const asError = (value) =>
  value instanceof Error
    ? value
    : new Error(value?.message || "Authentication failed.");

export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(configurationError);
  const mounted = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    let authEvents = 0;
    if (!supabase) {
      return () => {
        mounted.current = false;
        generation.current += 1;
      };
    }
    const callback = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const callbackError =
      callback.get("error_description") ||
      callback.get("error") ||
      fragment.get("error_description") ||
      fragment.get("error");
    if (callbackError) setError(new Error(callbackError));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      authEvents += 1;
      generation.current += 1;
      setSession(nextSession);
      setLoading(false);
      if (!callbackError) setError(null);
    });
    Promise.resolve()
      .then(() => supabase.auth.getSession())
      .then(({ data, error: sessionError }) => {
        if (!active || authEvents !== 0) return;
        if (sessionError) setError(asError(sessionError));
        else setSession(data.session);
        setLoading(false);
      })
      .catch((sessionError) => {
        if (!active || authEvents !== 0) return;
        setError(asError(sessionError));
        setLoading(false);
      });
    return () => {
      active = false;
      mounted.current = false;
      generation.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  async function authenticate(action) {
    if (!mounted.current) return;
    if (!supabase) {
      setError(configurationError || new Error("Supabase is not configured."));
      return;
    }
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const result = await action();
      if (result.error) throw result.error;
    } catch (actionError) {
      if (mounted.current && generation.current === request)
        setError(asError(actionError));
    } finally {
      if (mounted.current && generation.current === request) setLoading(false);
    }
  }

  const signIn = () =>
    authenticate(() =>
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      }),
    );
  const signOut = () => authenticate(() => supabase.auth.signOut());

  return {
    session,
    user: session?.user ?? null,
    loading,
    error,
    signIn,
    signOut,
  };
}
