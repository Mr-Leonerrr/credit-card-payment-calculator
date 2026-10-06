import { validatePayload, validateRow } from "./workspacePayload.js";

export function createWorkspaceRepository(client) {
  function requireClient() {
    if (!client) throw new Error("SYNC_NOT_CONFIGURED");
  }

  return {
    async load(userId) {
      requireClient();
      const { data, error } = await client
        .from("calculation_workspaces")
        .select("user_id,payload,schema_version,version")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data === null ? null : validateRow(data, userId);
    },
    async save(userId, payload, expectedVersion, isCurrent = () => true) {
      requireClient();
      validatePayload(payload);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
        throw new Error("INVALID_EXPECTED_VERSION");
      }
      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!isCurrent() || sessionData?.session?.user?.id !== userId) {
        throw new Error("AUTHENTICATION_REQUIRED");
      }
      const { data, error } = await client.rpc("save_calculation_workspace", {
        p_payload: payload,
        p_expected_version: expectedVersion,
      });
      if (error) throw error;
      return validateRow(data, userId);
    },
  };
}
