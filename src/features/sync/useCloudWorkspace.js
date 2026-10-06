import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { workspaceRepository } from "./services/repository.js";
import { createWorkspaceController } from "./workspaceController.js";

function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function useCloudWorkspace(user) {
  const userId = typeof user?.id === "string" && user.id ? user.id : null;
  const currentScope = useRef(null);
  function makeScope(id) {
    const scope = { id };
    scope.controller = createWorkspaceController({
      userId: id,
      repository: workspaceRepository,
      storage: browserStorage(),
      isCurrent: () => currentScope.current === scope,
    });
    return scope;
  }
  const [storedScope, setScope] = useState(() => makeScope(userId));
  let scope = storedScope;
  if (scope.id !== userId) {
    scope = makeScope(userId);
    setScope(scope);
  }
  currentScope.current = scope;
  const controller = scope.controller;
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  useEffect(() => {
    void controller.start();
    const refresh = () => {
      void controller.refresh();
    };
    const offline = () => controller.offline();
    globalThis.addEventListener?.("online", refresh);
    globalThis.addEventListener?.("offline", offline);
    globalThis.addEventListener?.("focus", refresh);
    const poll = setInterval(refresh, 20000);
    return () => {
      controller.stop();
      clearInterval(poll);
      globalThis.removeEventListener?.("online", refresh);
      globalThis.removeEventListener?.("offline", offline);
      globalThis.removeEventListener?.("focus", refresh);
    };
  }, [controller]);

  return {
    ...snapshot,
    canEdit:
      snapshot.canEdit &&
      scope.id === userId &&
      globalThis.navigator?.onLine !== false,
    setWorkspace: controller.setWorkspace,
    reload: controller.reload,
    importLocal: controller.importLocal,
  };
}
