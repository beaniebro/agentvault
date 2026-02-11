"use client";

import { useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { parseVaultObject, VaultData } from "@/lib/vault-parser";

export function useVault(vaultId: string | null) {
  const client = useSuiClient();

  return useQuery<VaultData | null>({
    queryKey: ["vault", vaultId],
    queryFn: async () => {
      if (!vaultId) return null;
      const obj = await client.getObject({
        id: vaultId,
        options: { showContent: true },
      });
      return parseVaultObject(obj.data);
    },
    enabled: !!vaultId,
    refetchInterval: 5000,
  });
}
