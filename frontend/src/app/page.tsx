"use client";

import { useCurrentAccount } from "@mysten/dapp-kit";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { useVault } from "@/hooks/useVault";
import { VaultCard } from "@/components/VaultCard";
import Link from "next/link";
import { useState } from "react";

function VaultCardLoader({ vaultId, onSelect }: { vaultId: string; onSelect: (id: string) => void }) {
  const { data: vault, isLoading } = useVault(vaultId);

  if (isLoading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-10 bg-gray-700 rounded w-1/2" />
      </div>
    );
  }

  if (!vault) return null;

  return <VaultCard vault={vault} onClick={() => onSelect(vaultId)} />;
}

export default function Dashboard() {
  const account = useCurrentAccount();
  const { data: vaultIds, isLoading } = useOwnedVaults();
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const { data: selectedVaultData } = useVault(selectedVault);

  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 className="text-3xl font-bold mb-4">AgentWall</h1>
        <p className="text-gray-400 mb-2">Transaction Firewall for AI Agents on Sui</p>
        <p className="text-gray-500 text-sm">Connect your wallet to get started</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Vaults</h1>
        <Link
          href="/create"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Create Vault
        </Link>
      </div>

      {isLoading && (
        <div className="text-gray-400">Loading vaults...</div>
      )}

      {vaultIds && vaultIds.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-400 mb-4">No vaults found</p>
          <Link
            href="/create"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            Create Your First Vault
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        {vaultIds?.map((id) => (
          <VaultCardLoader key={id} vaultId={id} onSelect={setSelectedVault} />
        ))}
      </div>

      {selectedVaultData && (
        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Vault Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Vault ID:</span>
              <p className="text-white font-mono text-xs break-all">{selectedVaultData.id}</p>
            </div>
            <div>
              <span className="text-gray-400">Agent:</span>
              <p className="text-white font-mono text-xs break-all">{selectedVaultData.agent}</p>
            </div>
            <div>
              <span className="text-gray-400">Denylist:</span>
              <p className="text-white">{selectedVaultData.denylist.length} addresses</p>
            </div>
            <div>
              <span className="text-gray-400">Allowlist:</span>
              <p className="text-white">{selectedVaultData.allowlist.length} addresses</p>
            </div>
            <div>
              <span className="text-gray-400">Tx Count (epoch):</span>
              <p className="text-white">{selectedVaultData.tx_count_this_epoch} / {selectedVaultData.max_tx_per_epoch}</p>
            </div>
            <div>
              <span className="text-gray-400">Last Epoch:</span>
              <p className="text-white">{selectedVaultData.last_epoch}</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link
              href="/pending"
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Pending ({selectedVaultData.pending_approvals.length})
            </Link>
            <Link
              href="/activity"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Activity
            </Link>
            <Link
              href="/settings"
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
            >
              Settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
