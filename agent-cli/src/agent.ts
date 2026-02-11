import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

// ============ CONFIGURATION ============
// Update these after deployment

const PACKAGE_ID = "0x4e064c7a2de2154802a38dce34d9b4610bac537a940c01ee90e432307f7f010a";
const VAULT_ID = "0xf7d39ed3c241e3f5ff9d66cfe8f7e7edef09b42c5afa5aaee3fcfc340f991001";

// Agent keypair — generate with: sui keytool generate ed25519
// Replace with your agent's private key (bech32 format: suiprivkey1...)
const AGENT_PRIVATE_KEY = "suiprivkey1qr3xeqltcwde3z3r0ar9hr4cmz43jzlr2xvv3lw8lls46p0utvajynk6vqk";

// Recipient addresses for demo
const ALLOWED_RECIPIENT = "0x1111111111111111111111111111111111111111111111111111111111111111";
const DENIED_RECIPIENT = "0x2222222222222222222222222222222222222222222222222222222222222222";
const UNKNOWN_RECIPIENT = "0x3333333333333333333333333333333333333333333333333333333333333333";

// Walrus
const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";

const MIST_PER_SUI = 1_000_000_000;

// ============ SETUP ============

const client = new SuiClient({ url: getFullnodeUrl("testnet") });

function getAgentKeypair(): Ed25519Keypair {
  const { secretKey } = decodeSuiPrivateKey(AGENT_PRIVATE_KEY);
  return Ed25519Keypair.fromSecretKey(secretKey);
}

// ============ WALRUS LOGGING ============

interface AuditEntry {
  timestamp: string;
  vault_id: string;
  agent: string;
  action: string;
  to: string;
  amount: string;
  result: "executed" | "blocked" | "queued";
  reason: string;
  tx_digest: string;
}

async function writeToWalrus(entry: AuditEntry): Promise<string | null> {
  try {
    const response = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=5`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });

    if (!response.ok) {
      console.log("  [Walrus] Write failed:", response.statusText);
      return null;
    }

    const result = await response.json();
    const blobId =
      result?.newlyCreated?.blobObject?.blobId ||
      result?.alreadyCertified?.blobId;

    if (blobId) {
      console.log(`  [Walrus] Audit log stored: ${blobId}`);
      return blobId;
    }
    return null;
  } catch (err) {
    console.log("  [Walrus] Write error (non-blocking):", err);
    return null;
  }
}

// ============ TRANSACTION HELPERS ============

async function requestTransfer(
  keypair: Ed25519Keypair,
  to: string,
  amountSui: number
): Promise<{ success: boolean; digest?: string; error?: string; events?: any[] }> {
  const amountMist = BigInt(Math.floor(amountSui * MIST_PER_SUI));

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::vault::request_transfer`,
    arguments: [
      tx.object(VAULT_ID),
      tx.pure.address(to),
      tx.pure.u64(amountMist),
    ],
  });

  try {
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEvents: true,
        showEffects: true,
      },
    });

    return {
      success: true,
      digest: result.digest,
      events: result.events || [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || String(err),
    };
  }
}

function extractEventType(events: any[]): string {
  if (!events || events.length === 0) return "unknown";
  const lastEvent = events[events.length - 1];
  const typeParts = lastEvent.type?.split("::") || [];
  return typeParts[typeParts.length - 1] || "unknown";
}

function extractReason(events: any[]): string {
  if (!events || events.length === 0) return "";
  const lastEvent = events[events.length - 1];
  return lastEvent.parsedJson?.reason || "";
}

// ============ DEMO SCENARIOS ============

async function runScenario(
  label: string,
  keypair: Ed25519Keypair,
  to: string,
  amountSui: number,
  expectedResult: string
) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`SCENARIO: ${label}`);
  console.log(`  To: ${to.slice(0, 10)}...`);
  console.log(`  Amount: ${amountSui} SUI`);
  console.log(`  Expected: ${expectedResult}`);
  console.log("-".repeat(60));

  const result = await requestTransfer(keypair, to, amountSui);

  if (result.success) {
    const eventType = extractEventType(result.events || []);
    const reason = extractReason(result.events || []);

    if (eventType === "TransferExecuted") {
      console.log(`  RESULT: EXECUTED`);
      console.log(`  Digest: ${result.digest}`);
      await writeToWalrus({
        timestamp: new Date().toISOString(),
        vault_id: VAULT_ID,
        agent: keypair.toSuiAddress(),
        action: "request_transfer",
        to,
        amount: amountSui.toString(),
        result: "executed",
        reason: "",
        tx_digest: result.digest!,
      });
    } else if (eventType === "TransferQueued") {
      console.log(`  RESULT: QUEUED (soft block)`);
      console.log(`  Reason: ${reason}`);
      console.log(`  Digest: ${result.digest}`);
      await writeToWalrus({
        timestamp: new Date().toISOString(),
        vault_id: VAULT_ID,
        agent: keypair.toSuiAddress(),
        action: "request_transfer",
        to,
        amount: amountSui.toString(),
        result: "queued",
        reason,
        tx_digest: result.digest!,
      });
    } else {
      console.log(`  RESULT: ${eventType}`);
      console.log(`  Digest: ${result.digest}`);
    }
  } else {
    // Transaction aborted — this is a hard block
    let reason = "unknown";
    if (result.error?.includes("EExceedsPerTxLimit") || result.error?.includes("MoveAbort") && result.error?.includes(", 2)")) {
      reason = "exceeds per-tx limit";
    } else if (result.error?.includes("EExceedsDailyLimit") || result.error?.includes(", 3)")) {
      reason = "exceeds daily limit";
    } else if (result.error?.includes("ERecipientDenylisted") || result.error?.includes(", 4)")) {
      reason = "recipient denylisted";
    } else if (result.error?.includes("EInvalidAmount") || result.error?.includes(", 8)")) {
      reason = "invalid amount";
    }

    console.log(`  RESULT: BLOCKED (hard block)`);
    console.log(`  Reason: ${reason}`);
    console.log(`  Error: ${result.error?.slice(0, 200)}`);

    // Write blocked event to Walrus (since on-chain events are lost on abort)
    await writeToWalrus({
      timestamp: new Date().toISOString(),
      vault_id: VAULT_ID,
      agent: keypair.toSuiAddress(),
      action: "request_transfer",
      to,
      amount: amountSui.toString(),
      result: "blocked",
      reason,
      tx_digest: "",
    });
  }
}

// ============ MAIN ============

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          AgentVault — AI Agent Demo Script               ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  if (PACKAGE_ID === "0xTODO" || VAULT_ID === "0xTODO") {
    console.error("\nERROR: Update PACKAGE_ID and VAULT_ID in agent.ts before running!");
    console.log("1. Deploy the contract: cd contracts/agent_wall && sui client publish --gas-budget 100000000");
    console.log("2. Create a vault using the frontend or CLI");
    console.log("3. Update the constants at the top of this file");
    process.exit(1);
  }

  const keypair = getAgentKeypair();
  const agentAddress = keypair.toSuiAddress();
  console.log(`\nAgent address: ${agentAddress}`);

  // Check agent balance
  const balance = await client.getBalance({ owner: agentAddress });
  console.log(`Agent SUI balance: ${(Number(balance.totalBalance) / MIST_PER_SUI).toFixed(4)} SUI`);

  if (Number(balance.totalBalance) < 0.1 * MIST_PER_SUI) {
    console.error("\nWARNING: Agent has very low SUI balance. Request from faucet:");
    console.log(`  sui client faucet --address ${agentAddress}`);
  }

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Scenario 1: Normal transfer within limits — should EXECUTE
  await runScenario(
    "1. Send 0.001 SUI to allowlisted address",
    keypair,
    ALLOWED_RECIPIENT,
    0.001,
    "EXECUTE (trusted, within auto-approve)"
  );

  await delay(2000);

  // Scenario 2: Send to denylisted address — should be BLOCKED
  await runScenario(
    "2. Send 0.001 SUI to denylisted address",
    keypair,
    DENIED_RECIPIENT,
    0.001,
    "BLOCKED (hard block — denylist)"
  );

  await delay(2000);

  // Scenario 3: Exceed per-tx limit — should be BLOCKED
  await runScenario(
    "3. Send 20 SUI (exceeds 10 SUI per-tx limit)",
    keypair,
    ALLOWED_RECIPIENT,
    20,
    "BLOCKED (hard block — exceeds per-tx limit)"
  );

  await delay(2000);

  // Scenario 4: Above auto-approve — should be QUEUED
  await runScenario(
    "4. Send 8 SUI to allowlisted (above 5 SUI auto-approve)",
    keypair,
    ALLOWED_RECIPIENT,
    8,
    "QUEUED (soft block — exceeds auto-approve)"
  );

  await delay(2000);

  // Scenario 5: Unknown recipient — should be QUEUED
  await runScenario(
    "5. Send 0.001 SUI to unknown address (not in allowlist)",
    keypair,
    UNKNOWN_RECIPIENT,
    0.001,
    "QUEUED (soft block — unknown recipient)"
  );

  await delay(2000);

  // Scenario 6: Small transfer — should EXECUTE
  await runScenario(
    "6. Send 0.001 SUI (another normal transfer)",
    keypair,
    ALLOWED_RECIPIENT,
    0.001,
    "EXECUTE (within all limits)"
  );

  console.log(`\n${"=".repeat(60)}`);
  console.log("DEMO COMPLETE");
  console.log("Check the frontend Activity tab to see all events!");
  console.log("Check the Pending tab to approve/reject queued transactions.");
  console.log("=".repeat(60));
}

main().catch(console.error);
