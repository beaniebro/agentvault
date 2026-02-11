"use client";

import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useOwnedVaults } from "@/hooks/useOwnedVaults";
import { useVault } from "@/hooks/useVault";
import {
  buildUpdateLimits,
  buildAddToDenylist,
  buildRemoveFromDenylist,
  buildAddToAllowlist,
  buildRemoveFromAllowlist,
  buildSetAgent,
  buildRevokeAgent,
  buildDeposit,
  buildWithdraw,
} from "@/lib/sui-helpers";
import { MIST_PER_SUI } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";

function formatSui(mist: string): string {
  return (Number(mist) / MIST_PER_SUI).toFixed(2);
}

export default function SettingsPage() {
  const account = useCurrentAccount();
  const { data: vaultIds } = useOwnedVaults();
  const [selectedVault, setSelectedVault] = useState<string | null>(null);
  const activeVaultId = selectedVault || (vaultIds && vaultIds[0]) || null;
  const { data: vault } = useVault(activeVaultId);
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const queryClient = useQueryClient();

  // Form states
  const [maxPerTx, setMaxPerTx] = useState("");
  const [maxDaily, setMaxDaily] = useState("");
  const [autoApprove, setAutoApprove] = useState("");
  const [maxTxPerEpoch, setMaxTxPerEpoch] = useState("");
  const [newDenyAddr, setNewDenyAddr] = useState("");
  const [newAllowAddr, setNewAllowAddr] = useState("");
  const [newAgent, setNewAgent] = useState("");
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const execTx = async (tx: any, successMsg: string) => {
    try {
      await signAndExecute({ transaction: tx });
      showMessage("success", successMsg);
      queryClient.invalidateQueries({ queryKey: ["vault"] });
    } catch (err: any) {
      showMessage("error", err.message || "Transaction failed");
    }
  };

  if (!account) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-gray-400">Connect your wallet to manage settings</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Vault Settings</h1>

      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.type === "success"
              ? "bg-green-900/30 border border-green-700 text-green-400"
              : "bg-red-900/30 border border-red-700 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {vaultIds && vaultIds.length > 1 && (
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
      )}

      {!vault ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-400">No vault selected or found</p>
        </div>
      ) : (
        <>
          {/* Deposit / Withdraw */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Funds (Balance: {formatSui(vault.balance)} SUI)</h2>
            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="number"
                  value={depositAmt}
                  onChange={(e) => setDepositAmt(e.target.value)}
                  placeholder="Amount (SUI)"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm mb-2"
                />
                <button
                  onClick={() => {
                    if (!activeVaultId || !depositAmt) return;
                    execTx(
                      buildDeposit(activeVaultId, BigInt(Math.floor(parseFloat(depositAmt) * MIST_PER_SUI))),
                      "Deposit successful"
                    );
                  }}
                  disabled={isPending}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 rounded-lg text-sm"
                >
                  Deposit
                </button>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value)}
                  placeholder="Amount (SUI)"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm mb-2"
                />
                <button
                  onClick={() => {
                    if (!activeVaultId || !withdrawAmt) return;
                    execTx(
                      buildWithdraw(activeVaultId, BigInt(Math.floor(parseFloat(withdrawAmt) * MIST_PER_SUI))),
                      "Withdrawal successful"
                    );
                  }}
                  disabled={isPending}
                  className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white py-2 rounded-lg text-sm"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>

          {/* Update Limits */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Limits</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-400">Max Per Tx (SUI) — current: {formatSui(vault.max_per_tx)}</label>
                <input
                  type="number"
                  value={maxPerTx}
                  onChange={(e) => setMaxPerTx(e.target.value)}
                  placeholder={formatSui(vault.max_per_tx)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Max Daily (SUI) — current: {formatSui(vault.max_daily)}</label>
                <input
                  type="number"
                  value={maxDaily}
                  onChange={(e) => setMaxDaily(e.target.value)}
                  placeholder={formatSui(vault.max_daily)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Auto-Approve (SUI) — current: {formatSui(vault.auto_approve_limit)}</label>
                <input
                  type="number"
                  value={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.value)}
                  placeholder={formatSui(vault.auto_approve_limit)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Max Tx/Epoch — current: {vault.max_tx_per_epoch}</label>
                <input
                  type="number"
                  value={maxTxPerEpoch}
                  onChange={(e) => setMaxTxPerEpoch(e.target.value)}
                  placeholder={vault.max_tx_per_epoch}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => {
                if (!activeVaultId) return;
                execTx(
                  buildUpdateLimits(
                    activeVaultId,
                    BigInt(Math.floor(parseFloat(maxPerTx || formatSui(vault.max_per_tx)) * MIST_PER_SUI)),
                    BigInt(Math.floor(parseFloat(maxDaily || formatSui(vault.max_daily)) * MIST_PER_SUI)),
                    BigInt(Math.floor(parseFloat(autoApprove || formatSui(vault.auto_approve_limit)) * MIST_PER_SUI)),
                    BigInt(maxTxPerEpoch || vault.max_tx_per_epoch)
                  ),
                  "Limits updated"
                );
              }}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              Update Limits
            </button>
          </div>

          {/* Denylist */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Denylist ({vault.denylist.length})</h2>
            {vault.denylist.length > 0 && (
              <div className="space-y-2 mb-4">
                {vault.denylist.map((addr) => (
                  <div key={addr} className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
                    <span className="text-sm font-mono text-white">{addr}</span>
                    <button
                      onClick={() => execTx(buildRemoveFromDenylist(activeVaultId!, addr), "Removed from denylist")}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newDenyAddr}
                onChange={(e) => setNewDenyAddr(e.target.value)}
                placeholder="0x..."
                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              />
              <button
                onClick={() => {
                  if (!activeVaultId || !newDenyAddr) return;
                  execTx(buildAddToDenylist(activeVaultId, newDenyAddr), "Added to denylist");
                  setNewDenyAddr("");
                }}
                disabled={isPending}
                className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Add
              </button>
            </div>
          </div>

          {/* Allowlist */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-2">Allowlist ({vault.allowlist.length})</h2>
            <p className="text-xs text-gray-400 mb-4">Empty allowlist = all recipients allowed. Add addresses to restrict.</p>
            {vault.allowlist.length > 0 && (
              <div className="space-y-2 mb-4">
                {vault.allowlist.map((addr) => (
                  <div key={addr} className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
                    <span className="text-sm font-mono text-white">{addr}</span>
                    <button
                      onClick={() => execTx(buildRemoveFromAllowlist(activeVaultId!, addr), "Removed from allowlist")}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newAllowAddr}
                onChange={(e) => setNewAllowAddr(e.target.value)}
                placeholder="0x..."
                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              />
              <button
                onClick={() => {
                  if (!activeVaultId || !newAllowAddr) return;
                  execTx(buildAddToAllowlist(activeVaultId, newAllowAddr), "Added to allowlist");
                  setNewAllowAddr("");
                }}
                disabled={isPending}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Add
              </button>
            </div>
          </div>

          {/* Agent Management */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Agent Management</h2>
            <p className="text-sm text-gray-400 mb-2">
              Current Agent: <span className="font-mono text-white">{vault.agent}</span>
            </p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                placeholder="New agent address 0x..."
                className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              />
              <button
                onClick={() => {
                  if (!activeVaultId || !newAgent) return;
                  execTx(buildSetAgent(activeVaultId, newAgent), "Agent updated");
                  setNewAgent("");
                }}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Set Agent
              </button>
            </div>
            <button
              onClick={() => {
                if (!activeVaultId) return;
                if (confirm("Are you sure you want to revoke the agent?")) {
                  execTx(buildRevokeAgent(activeVaultId), "Agent revoked");
                }
              }}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              Revoke Agent
            </button>
          </div>
        </>
      )}
    </div>
  );
}
