"use client";

import { VaultData } from "@/lib/vault-parser";
import { MIST_PER_SUI } from "@/lib/constants";

function formatSui(mist: string): string {
  return (Number(mist) / MIST_PER_SUI).toFixed(2);
}

function shortenAddr(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function VaultCard({
  vault,
  onClick,
}: {
  vault: VaultData;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 border border-gray-700 rounded-xl p-6 ${
        onClick ? "cursor-pointer hover:border-blue-500 transition-colors" : ""
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Vault</h3>
          <p className="text-xs text-gray-400 font-mono">{shortenAddr(vault.id)}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{formatSui(vault.balance)} SUI</p>
          <p className="text-xs text-gray-400">Balance</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-400">Agent</p>
          <p className="text-sm text-white font-mono">{shortenAddr(vault.agent)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Spent This Epoch</p>
          <p className="text-sm text-white">{formatSui(vault.spent_this_epoch)} / {formatSui(vault.max_daily)} SUI</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-700/50 rounded-lg p-2">
          <p className="text-xs text-gray-400">Per-Tx Limit</p>
          <p className="text-sm text-white font-semibold">{formatSui(vault.max_per_tx)}</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <p className="text-xs text-gray-400">Auto-Approve</p>
          <p className="text-sm text-white font-semibold">{formatSui(vault.auto_approve_limit)}</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <p className="text-xs text-gray-400">Pending</p>
          <p className="text-sm text-white font-semibold">{vault.pending_approvals.length}</p>
        </div>
      </div>

      {vault.pending_approvals.length > 0 && (
        <div className="mt-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-3 py-2">
          <p className="text-yellow-400 text-xs font-medium">
            {vault.pending_approvals.length} pending approval{vault.pending_approvals.length > 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
