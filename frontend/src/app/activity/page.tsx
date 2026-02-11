"use client";

import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { useVaultEvents, VaultEvent } from "@/hooks/useVaultEvents";
import { EventRow } from "@/components/EventRow";
import { readAllAuditLogs, AuditEntry } from "@/lib/walrus-client";
import { MIST_PER_SUI } from "@/lib/constants";

interface UnifiedEvent {
  type: string;
  to: string;
  amount: string;
  reason?: string;
  timestamp: string | number | null;
  txDigest?: string;
  source: "chain" | "walrus";
}

export default function ActivityPage() {
  const account = useCurrentAccount();
  const { data: vaultIds } = useOwnedVaults();
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const activeVaultId = selectedVault || (vaultIds && vaultIds[0]) || null;
  const { data: events } = useVaultEvents(activeVaultId);
  const [walrusEntries, setWalrusEntries] = useState<AuditEntry[]>([]);
  const [loadingWalrus, setLoadingWalrus] = useState(false);

  useEffect(() => {
    setLoadingWalrus(true);
    readAllAuditLogs()
      .then((entries) => {
        if (activeVaultId) {
          setWalrusEntries(entries.filter((e) => e.vault_id === activeVaultId));
        } else {
          setWalrusEntries(entries);
        }
      })
      .finally(() => setLoadingWalrus(false));
  }, [activeVaultId]);

  // Merge on-chain events with Walrus entries
  const unifiedEvents: UnifiedEvent[] = [];

  // On-chain events
  if (events) {
    for (const event of events) {
      const parsed = event.parsedJson;
      unifiedEvents.push({
        type: event.type,
        to: parsed?.to || "",
        amount: parsed?.amount || "0",
        reason: parsed?.reason || "",
        timestamp: event.timestampMs,
        txDigest: event.txDigest,
        source: "chain",
      });
    }
  }

  // Walrus entries (only add blocked ones not found on-chain)
  for (const entry of walrusEntries) {
    if (entry.result === "blocked") {
      unifiedEvents.push({
        type: entry.result,
        to: entry.to,
        amount: String(Math.floor(parseFloat(entry.amount) * MIST_PER_SUI)),
        reason: entry.reason,
        timestamp: new Date(entry.timestamp).getTime(),
        txDigest: entry.tx_digest || undefined,
        source: "walrus",
      });
    }
  }

  // Sort by timestamp descending
  unifiedEvents.sort((a, b) => {
    const tA = Number(a.timestamp || 0);
    const tB = Number(b.timestamp || 0);
    return tB - tA;
  });

  if (!account) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-400">Connect your wallet to view activity</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Activity Log</h1>
        {loadingWalrus && <span className="text-gray-400 text-sm">Loading Walrus data...</span>}
      </div>

      {vaultIds && vaultIds.length > 1 && (
        <div className="mb-4">
          <select
            value={activeVaultId || ""}
            onChange={(e) => setSelectedVault(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
          >
            {vaultIds.map((id) => (
              <option key={id} value={id}>
                {id.slice(0, 10)}...{id.slice(-6)}
              </option>
            ))}
          </select>
        </div>
      )}

      {unifiedEvents.length === 0 && !loadingWalrus && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-400">No activity yet. Run the agent CLI to generate events.</p>
        </div>
      )}

      <div className="space-y-2">
        {unifiedEvents.map((event, idx) => (
          <EventRow
            key={`${event.txDigest || idx}-${event.source}`}
            type={event.type}
            to={event.to}
            amount={event.amount}
            reason={event.reason}
            timestamp={event.timestamp}
            txDigest={event.txDigest}
          />
        ))}
      </div>
    </div>
  );
}
