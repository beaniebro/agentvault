const VAULT_IDS_KEY = "agentvault_vault_ids";

export function getStoredVaultIds(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(VAULT_IDS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveVaultId(vaultId: string): void {
  if (typeof window === "undefined") return;
  const ids = getStoredVaultIds();
  if (!ids.includes(vaultId)) {
    ids.push(vaultId);
    localStorage.setItem(VAULT_IDS_KEY, JSON.stringify(ids));
  }
}

export function removeVaultId(vaultId: string): void {
  if (typeof window === "undefined") return;
  const ids = getStoredVaultIds().filter((id) => id !== vaultId);
  localStorage.setItem(VAULT_IDS_KEY, JSON.stringify(ids));
}
