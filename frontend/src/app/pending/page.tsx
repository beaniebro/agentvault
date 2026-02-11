"use client";

import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { useVault } from "@/hooks/useVault";
import { PendingTxCard } from "@/components/PendingTxCard";
import { buildApprovePending, buildRejectPending } from "@/lib/sui-helpers";
import { writeAuditLog } from "@/lib/walrus-client";
import { MIST_PER_SUI } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";

export default function PendingPage() {
  const account = useCurrentAccount();
  const { data: vaultIds } = useOwnedVaults();
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const activeVaultId = selectedVault || (vaultIds && vaultIds[0]) || null;
  const { data: vault } = useVault(activeVaultId);
  const { mutateAsync: signAndExecute, isPending: isLoading } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleApprove = async (pendingId: number) => {
    if (!activeVaultId) return;
    setProcessingId(pendingId);
    try {
      const tx = buildApprovePending(activeVaultId, pendingId);
      const res = await signAndExecute({ transaction: tx });

      const pending = vault?.pending_approvals.find((p) => p.id === pendingId);
      if (pending) {
        writeAuditLog({
          timestamp: new Date().toISOString(),
          vault_id: activeVaultId,
          agent: vault?.agent || "",
          action: "approve_pending",
          to: pending.to,
          amount: (Number(pending.amount) / MIST_PER_SUI).toString(),
          result: "approved",
          reason: pending.reason,
          tx_digest: res.digest,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["vault"] });
    } catch (err: any) {
      alert(err.message || "Failed to approve");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (pendingId: number) => {
    if (!activeVaultId) return;
    setProcessingId(pendingId);
    try {
      const tx = buildRejectPending(activeVaultId, pendingId);
      const res = await signAndExecute({ transaction: tx });

      const pending = vault?.pending_approvals.find((p) => p.id === pendingId);
      if (pending) {
        writeAuditLog({
          timestamp: new Date().toISOString(),
          vault_id: activeVaultId,
          agent: vault?.agent || "",
          action: "reject_pending",
          to: pending.to,
          amount: (Number(pending.amount) / MIST_PER_SUI).toString(),
          result: "rejected",
          reason: pending.reason,
          tx_digest: res.digest,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["vault"] });
    } catch (err: any) {
      alert(err.message || "Failed to reject");
    } finally {
      setProcessingId(null);
    }
  };

  if (!account) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-gray-400">Connect your wallet to view pending approvals</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Pending Approvals</h1>

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

      {!vault && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-400">No vault selected or found</p>
        </div>
      )}

      {vault && vault.pending_approvals.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-400">No pending approvals</p>
        </div>
      )}

      <div className="grid gap-4">
        {vault?.pending_approvals.map((pending) => (
          <PendingTxCard
            key={pending.id}
            pending={pending}
            onApprove={() => handleApprove(pending.id)}
            onReject={() => handleReject(pending.id)}
            isLoading={processingId === pending.id}
          />
        ))}
      </div>
    </div>
  );
}
