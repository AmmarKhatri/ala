import { WorkspaceStore } from "../store/workspaceStore.js";

export async function collectGarbage(root: string, dryRun: boolean) {
  const store = await WorkspaceStore.openExisting(root);
  return store.gc(dryRun);
}
