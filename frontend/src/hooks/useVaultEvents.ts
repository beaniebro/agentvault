"use client";

import { useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { getEventType } from "@/lib/constants";

export interface VaultEvent {
  type: string;
  parsedJson: any;
  timestampMs: string | null;
  txDigest: string;
}

const EVENT_NAMES = [
  "TransferExecuted",
  "TransferQueued",
  "TransferApproved",
  "TransferRejected",
];

export function useVaultEvents(vaultId: string | null) {
  const client = useSuiClient();

  return useQuery<VaultEvent[]>({
    queryKey: ["vault-events", vaultId],
    queryFn: async () => {
      if (!vaultId) return [];

      const allEvents: VaultEvent[] = [];

      for (const eventName of EVENT_NAMES) {
        try {
          const result = await client.queryEvents({
            query: { MoveEventType: getEventType(eventName) },
            limit: 50,
            order: "descending",
          });

          for (const event of result.data) {
            if (event.parsedJson && (event.parsedJson as any).vault_id === vaultId) {
              allEvents.push({
                type: eventName,
                parsedJson: event.parsedJson,
                timestampMs: event.timestampMs ?? null,
                txDigest: event.id.txDigest,
              });
            }
          }
        } catch {
          // Event type might not exist yet
        }
      }

      return allEvents.sort((a, b) => {
        const tA = Number(a.timestampMs || 0);
        const tB = Number(b.timestampMs || 0);
        return tB - tA;
      });
    },
    enabled: !!vaultId,
    refetchInterval: 10000,
  });
}
