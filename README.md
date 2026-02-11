# AgentVault — Transaction Firewall for AI Agents on Sui

> **OpenClaw Hackathon 2026 — Track 1: Safety & Security**

AgentVault is an on-chain transaction firewall that protects AI agents from making unauthorized or dangerous transfers. An AI agent deposits funds into a Vault smart contract that enforces security rules — every transfer goes through a security pipeline before execution.

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────┐     ┌──────────────┐
│   AI Agent   │────▶│           Vault Smart Contract            │────▶│  Recipient   │
│  (CLI/SDK)   │     │                                          │     └──────────────┘
└─────────────┘     │  ┌────────────────────────────────────┐  │
                     │  │        Security Pipeline           │  │
      ┌──────┐       │  │                                    │  │     ┌──────────────┐
      │Owner │──────▶│  │  HARD BLOCKS (abort):             │  │     │   Walrus     │
      │(human)│      │  │  • Per-tx limit exceeded          │  │◀───▶│  (audit log) │
      └──────┘       │  │  • Daily limit exceeded           │  │     └──────────────┘
                     │  │  • Recipient denylisted           │  │
                     │  │                                    │  │
                     │  │  SOFT BLOCKS (queue for review):   │  │
                     │  │  • Unknown recipient (allowlist)   │  │
                     │  │  • Exceeds auto-approve limit      │  │
                     │  │  • Rate limit exceeded             │  │
                     │  │                                    │  │
                     │  │  AUTO-APPROVE:                     │  │
                     │  │  • All checks pass → execute       │  │
                     │  └────────────────────────────────────┘  │
                     └──────────────────────────────────────────┘
```

## Key Features

- **3 Hard Blocks**: Per-tx limit, daily limit, denylist — transaction aborts immediately
- **3 Soft Blocks**: Allowlist check, auto-approve threshold, rate limit — queues for owner review
- **Owner Approval Flow**: Human reviews and approves/rejects queued transactions
- **Epoch-Based Reset**: Daily limits reset each Sui epoch
- **Walrus Audit Trail**: All events (including blocked transactions) logged to Walrus
- **Full Dashboard**: Create vaults, manage settings, review pending approvals, view activity

## Project Structure

```
suixopenclaw/
├── contracts/agent_wall/           # Sui Move smart contract
│   ├── sources/vault.move          # Core vault + 14 entry functions
│   └── tests/vault_tests.move      # 20 unit tests
├── frontend/                       # Next.js + Tailwind + dapp-kit
│   └── src/
│       ├── app/                    # Pages: dashboard, create, pending, activity, settings
│       ├── components/             # VaultCard, PendingTxCard, EventRow, Sidebar
│       ├── hooks/                  # useVault, useVaultEvents, useOwnedVaults
│       └── lib/                    # constants, sui-helpers, walrus-client, vault-parser
├── agent-cli/                      # TypeScript CLI demo agent
│   └── src/agent.ts                # 6 demo scenarios
└── README.md
```

## Quick Start

### Prerequisites

- [Sui CLI](https://docs.sui.io/build/install) (v1.39+)
- Node.js 18+
- A Sui testnet wallet with SUI tokens

### 1. Deploy the Contract

```bash
cd contracts/agent_wall
sui move build
sui move test                        # 20 tests should pass
sui client publish --gas-budget 100000000
```

Save the `PACKAGE_ID` from the output.

### 2. Update Configuration

Update `PACKAGE_ID` in:
- `frontend/src/lib/constants.ts`
- `agent-cli/src/agent.ts`

### 3. Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000, connect your wallet, and create a vault.

### 4. Run the Agent Demo

```bash
cd agent-cli
npm install
```

Update `VAULT_ID`, `AGENT_PRIVATE_KEY`, and recipient addresses in `src/agent.ts`, then:

```bash
npx tsx src/agent.ts
```

The demo runs 6 scenarios showcasing all security pipeline behaviors:

| # | Scenario | Expected Result |
|---|----------|----------------|
| 1 | Send 3 SUI to allowlisted address | EXECUTED |
| 2 | Send 3 SUI to denylisted address | BLOCKED (denylist) |
| 3 | Send 20 SUI (exceeds per-tx limit) | BLOCKED (per-tx limit) |
| 4 | Send 8 SUI (above auto-approve) | QUEUED (auto-approve) |
| 5 | Send 3 SUI to unknown address | QUEUED (allowlist) |
| 6 | Rapid-fire transfers | QUEUED (rate limit) |

### 5. Approve/Reject in Frontend

Go to the **Pending** tab to review and approve/reject queued transactions. Check the **Activity** tab to see the full audit trail.

## Smart Contract API

### Owner Functions
| Function | Description |
|----------|-------------|
| `create_vault` | Create a new vault with security limits |
| `deposit` | Add SUI to the vault |
| `withdraw` | Remove SUI from the vault |
| `update_limits` | Change security thresholds |
| `add_to_denylist` / `remove_from_denylist` | Manage blocked addresses |
| `add_to_allowlist` / `remove_from_allowlist` | Manage trusted addresses |
| `approve_pending` | Execute a queued transaction |
| `reject_pending` | Reject a queued transaction |
| `set_agent` / `revoke_agent` | Manage the agent address |

### Agent Function
| Function | Description |
|----------|-------------|
| `request_transfer` | Submit a transfer through the security pipeline |

## Security Pipeline

```
request_transfer(vault, to, amount)
    │
    ├── Auth: sender == vault.agent?           → abort if not
    ├── Reset epoch counters if needed
    ├── Validate: amount > 0?                  → abort if not
    │
    ├── HARD BLOCK: amount <= max_per_tx?      → abort
    ├── HARD BLOCK: spent + amount <= daily?   → abort
    ├── HARD BLOCK: recipient not denylisted?  → abort
    │
    ├── SOFT BLOCK: in allowlist (if set)?     → queue "unknown recipient"
    ├── SOFT BLOCK: amount <= auto_approve?    → queue "exceeds auto-approve"
    ├── SOFT BLOCK: tx_count < max_per_epoch?  → queue "rate limit exceeded"
    │
    └── AUTO-EXECUTE: transfer SUI to recipient
```

## Testing

```bash
cd contracts/agent_wall
sui move test
# Test result: OK. Total tests: 20; passed: 20; failed: 0
```

## Production Vision: Agent Integration

AgentVault is **agent-framework agnostic**. The vault is the agent's wallet — instead of giving an AI agent a private key with direct access to funds, you deposit into a vault and the agent can only move funds through the security pipeline.

Any agent framework just needs to call one function:

```typescript
// Instead of: wallet.sendTransaction(to, amount)
// The agent calls: vault.request_transfer(to, amount)
```

**Integration with existing frameworks:**

| Framework | Integration |
|-----------|------------|
| **Eliza (ai16z)** | Sui plugin wrapping `request_transfer` as an action |
| **LangChain / CrewAI** | Tool definition that calls the vault contract |
| **Custom agents** | Use `@mysten/sui` SDK directly (like the demo CLI) |

AgentVault doesn't care what the agent *is* — it only verifies that the agent's signing key matches `vault.agent`. The security pipeline runs on-chain regardless of what triggered the transaction.

**Multi-agent setup** — one owner, multiple vaults with different policies:

```
Vault A → Trading Bot      → max 100 SUI/day, denylist enforced
Vault B → Payroll Agent    → allowlist-only, max 500 SUI/day
Vault C → Rewards Agent    → max 10 SUI/tx, rate limited to 50 tx/epoch
```

Each vault has independent limits, allowlists, denylists, and approval queues. A single owner dashboard manages them all.

## Tech Stack

- **Smart Contract**: Sui Move
- **Frontend**: Next.js 15, Tailwind CSS v4, @mysten/dapp-kit
- **Agent CLI**: TypeScript, @mysten/sui SDK
- **Audit Storage**: Walrus (testnet)
- **Network**: Sui Testnet

## License

MIT
