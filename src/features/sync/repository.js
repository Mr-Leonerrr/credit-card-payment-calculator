import { supabase } from "../../../lib/supabase.js";
import { createWorkspaceRepository } from "./repositoryAdapter.js";

export const workspaceRepository = createWorkspaceRepository(supabase);
