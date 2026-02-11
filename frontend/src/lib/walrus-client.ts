import { WALRUS_PUBLISHER, WALRUS_AGGREGATOR } from "./constants";

export interface AuditEntry {
  timestamp: string;
  vault_id: string;
  agent: string;
  action: string;
  to: string;
  amount: string;
  result: "executed" | "blocked" | "queued" | "approved" | "rejected";
  reason: string;
  tx_digest: string;
}

const STORAGE_KEY = "agentvault_walrus_blobs";

function getBlobIds(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveBlobId(blobId: string): void {
  if (typeof window === "undefined") return;
  const ids = getBlobIds();
  if (!ids.includes(blobId)) {
    ids.push(blobId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }
}

export async function writeAuditLog(entry: AuditEntry): Promise<string | null> {
  try {
    const response = await fetch(
      `${WALRUS_PUBLISHER}/v1/blobs?epochs=5`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }
    );

    if (!response.ok) {
      console.error("Walrus write failed:", response.statusText);
      return null;
    }

    const result = await response.json();
    const blobId =
      result?.newlyCreated?.blobObject?.blobId ||
      result?.alreadyCertified?.blobId;

    if (blobId) {
      saveBlobId(blobId);
      return blobId;
    }
    return null;
  } catch (err) {
    console.error("Walrus write error:", err);
    return null;
  }
}

export async function readAuditLog(blobId: string): Promise<AuditEntry | null> {
  try {
    const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    console.error("Walrus read error:", err);
    return null;
  }
}

export async function readAllAuditLogs(): Promise<AuditEntry[]> {
  const blobIds = getBlobIds();
  const entries: AuditEntry[] = [];

  const results = await Promise.allSettled(
    blobIds.map((id) => readAuditLog(id))
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      entries.push(result.value);
    }
  }

  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function getStoredBlobIds(): string[] {
  return getBlobIds();
}
