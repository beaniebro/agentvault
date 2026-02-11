import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, MODULE_NAME } from "./constants";

export function buildCreateVault(
  agent: string,
  maxPerTx: bigint,
  maxDaily: bigint,
  autoApproveLimit: bigint,
  maxTxPerEpoch: bigint,
  depositAmount: bigint
): Transaction {
  const tx = new Transaction();
  const [depositCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(depositAmount)]);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_vault`,
    arguments: [
      tx.pure.address(agent),
      tx.pure.u64(maxPerTx),
      tx.pure.u64(maxDaily),
      tx.pure.u64(autoApproveLimit),
      tx.pure.u64(maxTxPerEpoch),
      depositCoin,
    ],
  });
  return tx;
}

export function buildDeposit(vaultId: string, amount: bigint): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::deposit`,
    arguments: [tx.object(vaultId), coin],
  });
  return tx;
}

export function buildWithdraw(vaultId: string, amount: bigint): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::withdraw`,
    arguments: [tx.object(vaultId), tx.pure.u64(amount)],
  });
  return tx;
}

export function buildUpdateLimits(
  vaultId: string,
  maxPerTx: bigint,
  maxDaily: bigint,
  autoApproveLimit: bigint,
  maxTxPerEpoch: bigint
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::update_limits`,
    arguments: [
      tx.object(vaultId),
      tx.pure.u64(maxPerTx),
      tx.pure.u64(maxDaily),
      tx.pure.u64(autoApproveLimit),
      tx.pure.u64(maxTxPerEpoch),
    ],
  });
  return tx;
}

export function buildAddToDenylist(
  vaultId: string,
  addr: string
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::add_to_denylist`,
    arguments: [tx.object(vaultId), tx.pure.address(addr)],
  });
  return tx;
}

export function buildRemoveFromDenylist(
  vaultId: string,
  addr: string
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::remove_from_denylist`,
    arguments: [tx.object(vaultId), tx.pure.address(addr)],
  });
  return tx;
}

export function buildAddToAllowlist(
  vaultId: string,
  addr: string
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::add_to_allowlist`,
    arguments: [tx.object(vaultId), tx.pure.address(addr)],
  });
  return tx;
}

export function buildRemoveFromAllowlist(
  vaultId: string,
  addr: string
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::remove_from_allowlist`,
    arguments: [tx.object(vaultId), tx.pure.address(addr)],
  });
  return tx;
}

export function buildApprovePending(
  vaultId: string,
  pendingId: number
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::approve_pending`,
    arguments: [tx.object(vaultId), tx.pure.u64(pendingId)],
  });
  return tx;
}

export function buildRejectPending(
  vaultId: string,
  pendingId: number
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::reject_pending`,
    arguments: [tx.object(vaultId), tx.pure.u64(pendingId)],
  });
  return tx;
}

export function buildSetAgent(
  vaultId: string,
  newAgent: string
): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::set_agent`,
    arguments: [tx.object(vaultId), tx.pure.address(newAgent)],
  });
  return tx;
}

export function buildRevokeAgent(vaultId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::revoke_agent`,
    arguments: [tx.object(vaultId)],
  });
  return tx;
}
