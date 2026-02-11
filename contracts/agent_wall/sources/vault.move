#[allow(unused_field)]
module agent_wall::vault {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance::{Self, Balance};
    use sui::event;
    use std::string::String;

    // ======== Error Constants ========

    const ENotOwner: u64 = 0;
    const ENotAgent: u64 = 1;
    const EExceedsPerTxLimit: u64 = 2;
    const EExceedsDailyLimit: u64 = 3;
    const ERecipientDenylisted: u64 = 4;
    const EInsufficientBalance: u64 = 5;
    const EPendingTxNotFound: u64 = 6;
    const EInvalidAmount: u64 = 8;
    const EAutoApproveLimitExceedsPerTx: u64 = 9;

    // ======== Structs ========

    public struct Vault has key {
        id: UID,
        owner: address,
        agent: address,
        balance: Balance<SUI>,
        max_per_tx: u64,
        max_daily: u64,
        auto_approve_limit: u64,
        max_tx_per_epoch: u64,
        spent_this_epoch: u64,
        tx_count_this_epoch: u64,
        last_epoch: u64,
        denylist: vector<address>,
        allowlist: vector<address>,
        pending_approvals: vector<PendingTx>,
        next_pending_id: u64,
    }

    public struct PendingTx has store, drop {
        id: u64,
        to: address,
        amount: u64,
        created_epoch: u64,
        reason: String,
    }

    // ======== Events ========

    public struct VaultCreated has copy, drop {
        vault_id: address,
        owner: address,
        agent: address,
    }

    public struct TransferExecuted has copy, drop {
        vault_id: address,
        to: address,
        amount: u64,
    }

    public struct TransferBlocked has copy, drop {
        vault_id: address,
        to: address,
        amount: u64,
        reason: String,
    }

    public struct TransferQueued has copy, drop {
        vault_id: address,
        pending_id: u64,
        to: address,
        amount: u64,
        reason: String,
    }

    public struct TransferApproved has copy, drop {
        vault_id: address,
        pending_id: u64,
        to: address,
        amount: u64,
    }

    public struct TransferRejected has copy, drop {
        vault_id: address,
        pending_id: u64,
        to: address,
        amount: u64,
    }

    // ======== Owner Functions ========

    /// Create a new vault for an agent. The caller becomes the owner.
    public entry fun create_vault(
        agent: address,
        max_per_tx: u64,
        max_daily: u64,
        auto_approve_limit: u64,
        max_tx_per_epoch: u64,
        deposit: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        assert!(auto_approve_limit <= max_per_tx, EAutoApproveLimitExceedsPerTx);

        let vault = Vault {
            id: object::new(ctx),
            owner: tx_context::sender(ctx),
            agent,
            balance: coin::into_balance(deposit),
            max_per_tx,
            max_daily,
            auto_approve_limit,
            max_tx_per_epoch,
            spent_this_epoch: 0,
            tx_count_this_epoch: 0,
            last_epoch: tx_context::epoch(ctx),
            denylist: vector::empty(),
            allowlist: vector::empty(),
            pending_approvals: vector::empty(),
            next_pending_id: 0,
        };

        let vault_id = object::uid_to_address(&vault.id);
        event::emit(VaultCreated {
            vault_id,
            owner: tx_context::sender(ctx),
            agent,
        });

        transfer::share_object(vault);
    }

    /// Owner deposits additional SUI into the vault.
    public entry fun deposit(
        vault: &mut Vault,
        payment: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
        balance::join(&mut vault.balance, coin::into_balance(payment));
    }

    /// Owner withdraws SUI from the vault.
    public entry fun withdraw(
        vault: &mut Vault,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
        assert!(balance::value(&vault.balance) >= amount, EInsufficientBalance);

        let withdrawn = coin::take(&mut vault.balance, amount, ctx);
        transfer::public_transfer(withdrawn, vault.owner);
    }

    /// Owner updates vault limits.
    public entry fun update_limits(
        vault: &mut Vault,
        max_per_tx: u64,
        max_daily: u64,
        auto_approve_limit: u64,
        max_tx_per_epoch: u64,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
        assert!(auto_approve_limit <= max_per_tx, EAutoApproveLimitExceedsPerTx);

        vault.max_per_tx = max_per_tx;
        vault.max_daily = max_daily;
        vault.auto_approve_limit = auto_approve_limit;
        vault.max_tx_per_epoch = max_tx_per_epoch;
    }

    /// Owner adds an address to the denylist.
    public entry fun add_to_denylist(
        vault: &mut Vault,
        addr: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
        if (!is_denylisted(&vault.denylist, addr)) {
            vector::push_back(&mut vault.denylist, addr);
        };
    }

    /// Owner removes an address from the denylist.
    public entry fun remove_from_denylist(
        vault: &mut Vault,
        addr: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
        let (found, idx) = find_address(&vault.denylist, addr);
        if (found) {
            vector::remove(&mut vault.denylist, idx);
        };
    }

    /// Owner adds an address to the allowlist.
    public entry fun add_to_allowlist(
        vault: &mut Vault,
        addr: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
        if (!is_allowlisted(&vault.allowlist, addr)) {
            vector::push_back(&mut vault.allowlist, addr);
        };
    }

    /// Owner removes an address from the allowlist.
    public entry fun remove_from_allowlist(
        vault: &mut Vault,
        addr: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
        let (found, idx) = find_address(&vault.allowlist, addr);
        if (found) {
            vector::remove(&mut vault.allowlist, idx);
        };
    }

    /// Owner approves a pending transaction. Executes the transfer.
    public entry fun approve_pending(
        vault: &mut Vault,
        pending_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);

        let idx = find_pending_index(&vault.pending_approvals, pending_id);
        let pending = vector::remove(&mut vault.pending_approvals, idx);

        assert!(balance::value(&vault.balance) >= pending.amount, EInsufficientBalance);

        // Update epoch tracking for approved tx
        maybe_reset_epoch(vault, ctx);
        vault.spent_this_epoch = vault.spent_this_epoch + pending.amount;
        vault.tx_count_this_epoch = vault.tx_count_this_epoch + 1;

        let payment = coin::take(&mut vault.balance, pending.amount, ctx);
        transfer::public_transfer(payment, pending.to);

        let vault_id = object::uid_to_address(&vault.id);
        event::emit(TransferApproved {
            vault_id,
            pending_id: pending.id,
            to: pending.to,
            amount: pending.amount,
        });
    }

    /// Owner rejects a pending transaction. Funds stay in vault.
    public entry fun reject_pending(
        vault: &mut Vault,
        pending_id: u64,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);

        let idx = find_pending_index(&vault.pending_approvals, pending_id);
        let pending = vector::remove(&mut vault.pending_approvals, idx);

        let vault_id = object::uid_to_address(&vault.id);
        event::emit(TransferRejected {
            vault_id,
            pending_id: pending.id,
            to: pending.to,
            amount: pending.amount,
        });
    }

    /// Owner sets a new agent address.
    public entry fun set_agent(
        vault: &mut Vault,
        new_agent: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
        vault.agent = new_agent;
    }

    /// Owner revokes the agent (sets to @0x0).
    public entry fun revoke_agent(
        vault: &mut Vault,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == vault.owner, ENotOwner);
        vault.agent = @0x0;
    }

    // ======== Agent Function ========

    /// Agent requests a transfer. Goes through the security pipeline.
    public entry fun request_transfer(
        vault: &mut Vault,
        to: address,
        amount: u64,
        ctx: &mut TxContext,
    ) {
        // Step 1: Auth check
        assert!(tx_context::sender(ctx) == vault.agent, ENotAgent);

        // Step 2: Reset epoch counters if needed
        maybe_reset_epoch(vault, ctx);

        // Step 3: Validate amount
        assert!(amount > 0, EInvalidAmount);

        // === HARD BLOCKS (abort — definitely bad) ===

        // Step 4: Per-transaction limit
        assert!(amount <= vault.max_per_tx, EExceedsPerTxLimit);

        // Step 5: Daily limit
        assert!(vault.spent_this_epoch + amount <= vault.max_daily, EExceedsDailyLimit);

        // Step 6: Denylist check
        assert!(!is_denylisted(&vault.denylist, to), ERecipientDenylisted);

        // === SOFT BLOCKS (queue — needs human judgment) ===

        let vault_id = object::uid_to_address(&vault.id);

        // Step 7: Allowlist check (only if allowlist is non-empty)
        if (!vector::is_empty(&vault.allowlist) && !is_allowlisted(&vault.allowlist, to)) {
            queue_transfer(vault, to, amount, b"unknown recipient", ctx);
            return
        };

        // Step 8: Auto-approve limit check
        if (amount > vault.auto_approve_limit) {
            queue_transfer(vault, to, amount, b"exceeds auto-approve limit", ctx);
            return
        };

        // Step 9: Rate limit check
        if (vault.tx_count_this_epoch >= vault.max_tx_per_epoch) {
            queue_transfer(vault, to, amount, b"rate limit exceeded", ctx);
            return
        };

        // === AUTO-EXECUTE ===

        // Step 10: All checks pass — execute transfer
        assert!(balance::value(&vault.balance) >= amount, EInsufficientBalance);

        vault.spent_this_epoch = vault.spent_this_epoch + amount;
        vault.tx_count_this_epoch = vault.tx_count_this_epoch + 1;

        let payment = coin::take(&mut vault.balance, amount, ctx);
        transfer::public_transfer(payment, to);

        event::emit(TransferExecuted {
            vault_id,
            to,
            amount,
        });
    }

    // ======== Helper Functions ========

    /// Queue a transfer for owner approval.
    fun queue_transfer(
        vault: &mut Vault,
        to: address,
        amount: u64,
        reason: vector<u8>,
        ctx: &mut TxContext,
    ) {
        let pending_id = vault.next_pending_id;
        vault.next_pending_id = vault.next_pending_id + 1;

        let reason_str = std::string::utf8(reason);
        let vault_id = object::uid_to_address(&vault.id);

        vector::push_back(&mut vault.pending_approvals, PendingTx {
            id: pending_id,
            to,
            amount,
            created_epoch: tx_context::epoch(ctx),
            reason: reason_str,
        });

        event::emit(TransferQueued {
            vault_id,
            pending_id,
            to,
            amount,
            reason: std::string::utf8(reason),
        });
    }

    /// Check if an address is in the denylist.
    fun is_denylisted(denylist: &vector<address>, addr: address): bool {
        let len = vector::length(denylist);
        let mut i = 0;
        while (i < len) {
            if (*vector::borrow(denylist, i) == addr) {
                return true
            };
            i = i + 1;
        };
        false
    }

    /// Check if an address is in the allowlist.
    fun is_allowlisted(allowlist: &vector<address>, addr: address): bool {
        let len = vector::length(allowlist);
        let mut i = 0;
        while (i < len) {
            if (*vector::borrow(allowlist, i) == addr) {
                return true
            };
            i = i + 1;
        };
        false
    }

    /// Find the index of a pending tx by its ID. Aborts if not found.
    fun find_pending_index(pending: &vector<PendingTx>, pending_id: u64): u64 {
        let len = vector::length(pending);
        let mut i = 0;
        while (i < len) {
            if (vector::borrow(pending, i).id == pending_id) {
                return i
            };
            i = i + 1;
        };
        abort EPendingTxNotFound
    }

    /// Find an address in a vector. Returns (found, index).
    fun find_address(addrs: &vector<address>, addr: address): (bool, u64) {
        let len = vector::length(addrs);
        let mut i = 0;
        while (i < len) {
            if (*vector::borrow(addrs, i) == addr) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    /// Reset epoch counters if the current epoch differs from last_epoch.
    fun maybe_reset_epoch(vault: &mut Vault, ctx: &TxContext) {
        let current_epoch = tx_context::epoch(ctx);
        if (current_epoch > vault.last_epoch) {
            vault.spent_this_epoch = 0;
            vault.tx_count_this_epoch = 0;
            vault.last_epoch = current_epoch;
        };
    }

    // ======== Test-Only Accessors ========

    #[test_only]
    public fun get_balance(vault: &Vault): u64 {
        balance::value(&vault.balance)
    }

    #[test_only]
    public fun get_pending_count(vault: &Vault): u64 {
        vector::length(&vault.pending_approvals) as u64
    }

    #[test_only]
    public fun get_spent_this_epoch(vault: &Vault): u64 {
        vault.spent_this_epoch
    }

    #[test_only]
    public fun get_tx_count_this_epoch(vault: &Vault): u64 {
        vault.tx_count_this_epoch
    }

    #[test_only]
    public fun get_owner(vault: &Vault): address {
        vault.owner
    }

    #[test_only]
    public fun get_agent(vault: &Vault): address {
        vault.agent
    }

    #[test_only]
    public fun get_max_per_tx(vault: &Vault): u64 {
        vault.max_per_tx
    }

    #[test_only]
    public fun get_max_daily(vault: &Vault): u64 {
        vault.max_daily
    }

    #[test_only]
    public fun get_auto_approve_limit(vault: &Vault): u64 {
        vault.auto_approve_limit
    }

    #[test_only]
    public fun get_max_tx_per_epoch(vault: &Vault): u64 {
        vault.max_tx_per_epoch
    }

    #[test_only]
    public fun get_denylist_length(vault: &Vault): u64 {
        vector::length(&vault.denylist) as u64
    }

    #[test_only]
    public fun get_allowlist_length(vault: &Vault): u64 {
        vector::length(&vault.allowlist) as u64
    }

    #[test_only]
    public fun get_next_pending_id(vault: &Vault): u64 {
        vault.next_pending_id
    }
}
