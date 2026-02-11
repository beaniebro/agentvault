export interface PendingTx {
  id: number;
  to: string;
  amount: string;
  created_epoch: string;
  reason: string;
}

export interface VaultData {
  id: string;
  owner: string;
  agent: string;
  balance: string;
  max_per_tx: string;
  max_daily: string;
  auto_approve_limit: string;
  max_tx_per_epoch: string;
  spent_this_epoch: string;
  tx_count_this_epoch: string;
  last_epoch: string;
  denylist: string[];
  allowlist: string[];
  pending_approvals: PendingTx[];
  next_pending_id: string;
}

export function parseVaultObject(data: any): VaultData | null {
  if (!data || !data.content || data.content.dataType !== "moveObject") {
    return null;
  }

  const fields = data.content.fields;
  if (!fields) return null;

  return {
    id: data.objectId,
    owner: fields.owner,
    agent: fields.agent,
    balance: fields.balance,
    max_per_tx: fields.max_per_tx,
    max_daily: fields.max_daily,
    auto_approve_limit: fields.auto_approve_limit,
    max_tx_per_epoch: fields.max_tx_per_epoch,
    spent_this_epoch: fields.spent_this_epoch,
    tx_count_this_epoch: fields.tx_count_this_epoch,
    last_epoch: fields.last_epoch,
    denylist: fields.denylist || [],
    allowlist: fields.allowlist || [],
    pending_approvals: (fields.pending_approvals || []).map((p: any) => ({
      id: Number(p.fields?.id ?? p.id),
      to: p.fields?.to ?? p.to,
      amount: String(p.fields?.amount ?? p.amount),
      created_epoch: String(p.fields?.created_epoch ?? p.created_epoch),
      reason: p.fields?.reason ?? p.reason,
    })),
    next_pending_id: fields.next_pending_id,
  };
}
