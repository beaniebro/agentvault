"use client";

import { useState } from "react";
import { useSignAndExecuteTransaction, useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { buildCreateVault } from "@/lib/sui-helpers";
import { MIST_PER_SUI } from "@/lib/constants";
import { saveVaultId } from "@/lib/walrus-storage";
import { useQueryClient } from "@tanstack/react-query";

export default function CreateVaultPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();
  const { mutateAsync: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [agent, setAgent] = useState("");
  const [agentPrivateKey, setAgentPrivateKey] = useState<string | null>(null);
  const [maxPerTx, setMaxPerTx] = useState("10");
  const [maxDaily, setMaxDaily] = useState("50");
  const [autoApprove, setAutoApprove] = useState("5");
  const [maxTxPerEpoch, setMaxTxPerEpoch] = useState("20");
  const [deposit, setDeposit] = useState("10");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!account) return;
    setError(null);
    setResult(null);

    try {
      const tx = buildCreateVault(
        agent,
        BigInt(Math.floor(parseFloat(maxPerTx) * MIST_PER_SUI)),
        BigInt(Math.floor(parseFloat(maxDaily) * MIST_PER_SUI)),
        BigInt(Math.floor(parseFloat(autoApprove) * MIST_PER_SUI)),
        BigInt(maxTxPerEpoch),
        BigInt(Math.floor(parseFloat(deposit) * MIST_PER_SUI))
      );

      const res = await signAndExecute({ transaction: tx });
      const digest = res.digest;

      // Wait for transaction and get events
      const txResult = await suiClient.waitForTransaction({
        digest,
        options: { showEvents: true },
      });

      let vaultFound = false;
      if (txResult.events) {
        for (const event of txResult.events) {
          const parsed = event.parsedJson as any;
          if (parsed?.vault_id) {
            saveVaultId(parsed.vault_id);
            setResult(`Vault created! ID: ${parsed.vault_id}`);
            vaultFound = true;
            break;
          }
        }
      }

      if (!vaultFound) {
        setResult(`Transaction successful: ${digest}`);
      }

      queryClient.invalidateQueries({ queryKey: ["owned-vaults"] });
    } catch (err: any) {
      setError(err.message || "Failed to create vault");
    }
  };

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-gray-400">Connect your wallet to create a vault</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create Vault</h1>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Agent Address</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={agent}
              onChange={(e) => { setAgent(e.target.value); setAgentPrivateKey(null); }}
              placeholder="0x..."
              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const keypair = new Ed25519Keypair();
                setAgent(keypair.toSuiAddress());
                setAgentPrivateKey(keypair.getSecretKey());
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors"
            >
              Generate
            </button>
          </div>
          {agentPrivateKey && (
            <div className="mt-2 bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
              <p className="text-yellow-400 text-xs font-medium mb-1">Save this private key for the agent CLI:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-yellow-300 break-all flex-1">{agentPrivateKey}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(agentPrivateKey)}
                  className="text-yellow-400 hover:text-yellow-300 text-xs whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
              <p className="text-yellow-600 text-xs mt-1">Fund this address before running the agent demo.</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Per Tx (SUI)</label>
            <input
              type="number"
              value={maxPerTx}
              onChange={(e) => setMaxPerTx(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Daily (SUI)</label>
            <input
              type="number"
              value={maxDaily}
              onChange={(e) => setMaxDaily(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Auto-Approve Limit (SUI)</label>
            <input
              type="number"
              value={autoApprove}
              onChange={(e) => setAutoApprove(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Max Tx Per Epoch</label>
            <input
              type="number"
              value={maxTxPerEpoch}
              onChange={(e) => setMaxTxPerEpoch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Initial Deposit (SUI)</label>
          <input
            type="number"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={isPending || !agent}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
        >
          {isPending ? "Creating..." : "Create Vault"}
        </button>

        {result && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-3">
            <p className="text-green-400 text-sm break-all">{result}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
            <p className="text-red-400 text-sm break-all">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
