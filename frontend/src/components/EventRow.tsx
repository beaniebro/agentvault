"use client";

import { MIST_PER_SUI } from "@/lib/constants";

const RESULT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  TransferExecuted: { bg: "bg-green-900/30", text: "text-green-400", label: "EXECUTED" },
  TransferBlocked: { bg: "bg-red-900/30", text: "text-red-400", label: "BLOCKED" },
  TransferQueued: { bg: "bg-yellow-900/30", text: "text-yellow-400", label: "QUEUED" },
  TransferApproved: { bg: "bg-blue-900/30", text: "text-blue-400", label: "APPROVED" },
  TransferRejected: { bg: "bg-red-900/30", text: "text-red-400", label: "REJECTED" },
  // Walrus-sourced entries
  executed: { bg: "bg-green-900/30", text: "text-green-400", label: "EXECUTED" },
  blocked: { bg: "bg-red-900/30", text: "text-red-400", label: "BLOCKED" },
  queued: { bg: "bg-yellow-900/30", text: "text-yellow-400", label: "QUEUED" },
  approved: { bg: "bg-blue-900/30", text: "text-blue-400", label: "APPROVED" },
  rejected: { bg: "bg-red-900/30", text: "text-red-400", label: "REJECTED" },
};

function formatSui(mist: string | number): string {
  return (Number(mist) / MIST_PER_SUI).toFixed(4);
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length <= 10) return addr || "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatTime(ts: string | number | null): string {
  if (!ts) return "—";
  const d = new Date(Number(ts));
  return d.toLocaleTimeString();
}

export function EventRow({
  type,
  to,
  amount,
  reason,
  timestamp,
  txDigest,
}: {
  type: string;
  to?: string;
  amount?: string | number;
  reason?: string;
  timestamp?: string | number | null;
  txDigest?: string;
}) {
  const style = RESULT_STYLES[type] || RESULT_STYLES["executed"];

  return (
    <div className={`${style.bg} border border-gray-700 rounded-lg p-3 flex items-center gap-4`}>
      <span className={`${style.text} text-xs font-bold px-2 py-1 rounded min-w-[90px] text-center`}>
        {style.label}
      </span>

      <div className="flex-1 grid grid-cols-3 gap-2 text-sm">
        <div>
          <span className="text-gray-400">To: </span>
          <span className="text-white font-mono">{shortenAddr(to || "")}</span>
        </div>
        <div>
          <span className="text-gray-400">Amount: </span>
          <span className="text-white">{amount ? `${formatSui(amount)} SUI` : "—"}</span>
        </div>
        <div>
          <span className="text-gray-400">Time: </span>
          <span className="text-gray-300">{formatTime(timestamp ?? null)}</span>
        </div>
      </div>

      {reason && (
        <span className="text-gray-400 text-xs italic max-w-[200px] truncate">
          {reason}
        </span>
      )}

      {txDigest && (
        <a
          href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 text-xs font-mono"
        >
          {txDigest.slice(0, 8)}...
        </a>
      )}
    </div>
  );
}
