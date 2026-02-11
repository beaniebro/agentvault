"use client";

import { PendingTx } from "@/lib/vault-parser";
import { MIST_PER_SUI } from "@/lib/constants";

function formatSui(mist: string): string {
  return (Number(mist) / MIST_PER_SUI).toFixed(4);
}

function shortenAddr(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function PendingTxCard({
  pending,
  onApprove,
  onReject,
  isLoading,
}: {
  pending: PendingTx;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="bg-gray-800 border border-yellow-700/50 rounded-xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="inline-block bg-yellow-900/50 text-yellow-400 text-xs px-2 py-1 rounded-full mb-2">
            Pending #{pending.id}
          </span>
          <p className="text-white font-semibold text-lg">{formatSui(pending.amount)} SUI</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">To:</span>
          <span className="text-white text-sm font-mono">{shortenAddr(pending.to)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Reason:</span>
          <span className="text-yellow-400 text-sm">{pending.reason}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400 text-sm">Epoch:</span>
          <span className="text-gray-300 text-sm">{pending.created_epoch}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onApprove}
          disabled={isLoading}
          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
        >
          {isLoading ? "..." : "Approve"}
        </button>
        <button
          onClick={onReject}
          disabled={isLoading}
          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
        >
          {isLoading ? "..." : "Reject"}
        </button>
      </div>
    </div>
  );
}
