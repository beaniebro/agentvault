# AgentVault — Transaction Firewall for AI Agents on Sui

## Project Structure
```
suixopenclaw/
├── contracts/agent_wall/    # Sui Move smart contract
│   ├── sources/vault.move   # Core vault + security pipeline
│   └── tests/vault_tests.move
├── frontend/                # Next.js + Tailwind + dapp-kit
│   └── src/
│       ├── app/             # Pages: dashboard, create, pending, activity, settings
│       ├── components/      # VaultCard, PendingTxCard, EventRow, Sidebar
│       ├── hooks/           # useVault, useVaultEvents, useOwnedVaults
│       └── lib/             # constants, sui-helpers, walrus-client, vault-parser
├── agent-cli/               # TypeScript CLI demo agent
│   └── src/agent.ts
└── CLAUDE.md
```

## Commands
- **Build contract**: `cd contracts/agent_wall && sui move build`
- **Test contract**: `cd contracts/agent_wall && sui move test`
- **Run frontend**: `cd frontend && npm run dev`
- **Run agent demo**: `cd agent-cli && npx tsx src/agent.ts`

## Key Constants
- PACKAGE_ID: Set after deployment in `frontend/src/lib/constants.ts` and `agent-cli/src/agent.ts`
- Walrus Publisher: `https://publisher.walrus-testnet.walrus.space`
- Walrus Aggregator: `https://aggregator.walrus-testnet.walrus.space`

## Architecture
- One vault per agent (shared object on Sui)
- Security pipeline: hard blocks (abort) → soft blocks (queue) → auto-execute
- Vault discovery via VaultCreated events + localStorage
- Blocked txs logged to Walrus (events lost on abort)
