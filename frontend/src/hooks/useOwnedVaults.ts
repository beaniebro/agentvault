"use client";

import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { getEventType } from "@/lib/constants";
import { getStoredVaultIds, saveVaultId } from "@/lib/walrus-storage";

export function useOwnedVaults() {
  const client = useSuiClient();
  const account = useCurrentAccount();

  return useQuery<string[]>({
    queryKey: ["owned-vaults", account?.address],
    queryFn: async () => {
      if (!account?.address) return [];

      const vaultIds = new Set<string>(getStoredVaultIds());

      // Also try querying VaultCreated events
      try {
        const result = await client.queryEvents({
          query: { MoveEventType: getEventType("VaultCreated") },
          limit: 50,
          order: "descending",
        });

        for (const event of result.data) {
          const parsed = event.parsedJson as any;
          if (parsed?.owner === account.address) {
            vaultIds.add(parsed.vault_id);
            saveVaultId(parsed.vault_id);
          }
        }
      } catch {
        // Events might not exist yet
      }

      return Array.from(vaultIds);
    },
    enabled: !!account?.address,
    refetchInterval: 10000,
  });
}
