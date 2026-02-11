#[test_only]
module agent_wall::vault_tests {
    use sui::test_scenario::{Self as ts};
    use sui::coin::{Self};
    use sui::sui::SUI;
    use agent_wall::vault::{Self, Vault};

    // Test addresses
    const OWNER: address = @0xA;
    const AGENT: address = @0xB;
    const RECIPIENT: address = @0xC;
    const DENIED_ADDR: address = @0xD;
    const UNKNOWN_ADDR: address = @0xE;
    const STRANGER: address = @0xF;

    // Default limits (in MIST: 1 SUI = 1_000_000_000 MIST)
    const MAX_PER_TX: u64 = 10_000_000_000;      // 10 SUI
    const MAX_DAILY: u64 = 50_000_000_000;        // 50 SUI
    const AUTO_APPROVE: u64 = 5_000_000_000;      // 5 SUI
    const MAX_TX_PER_EPOCH: u64 = 20;
    const DEPOSIT_AMOUNT: u64 = 100_000_000_000;  // 100 SUI

    // ======== Helper ========

    fun create_test_vault(scenario: &mut ts::Scenario) {
        ts::next_tx(scenario, OWNER);
        {
            let deposit_coin = coin::mint_for_testing<SUI>(DEPOSIT_AMOUNT, ts::ctx(scenario));
            vault::create_vault(
                AGENT,
                MAX_PER_TX,
                MAX_DAILY,
                AUTO_APPROVE,
                MAX_TX_PER_EPOCH,
                deposit_coin,
                ts::ctx(scenario),
            );
        };
    }

    // ======== Test 1: Create vault and verify initial state ========

    #[test]
    fun test_create_vault() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        ts::next_tx(&mut scenario, OWNER);
        {
            let vault = ts::take_shared<Vault>(&scenario);
            assert!(vault::get_owner(&vault) == OWNER);
            assert!(vault::get_agent(&vault) == AGENT);
            assert!(vault::get_balance(&vault) == DEPOSIT_AMOUNT);
            assert!(vault::get_max_per_tx(&vault) == MAX_PER_TX);
            assert!(vault::get_max_daily(&vault) == MAX_DAILY);
            assert!(vault::get_auto_approve_limit(&vault) == AUTO_APPROVE);
            assert!(vault::get_max_tx_per_epoch(&vault) == MAX_TX_PER_EPOCH);
            assert!(vault::get_spent_this_epoch(&vault) == 0);
            assert!(vault::get_tx_count_this_epoch(&vault) == 0);
            assert!(vault::get_pending_count(&vault) == 0);
            assert!(vault::get_denylist_length(&vault) == 0);
            assert!(vault::get_allowlist_length(&vault) == 0);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 2: Transfer within all limits succeeds ========

    #[test]
    fun test_transfer_within_limits() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Agent sends within limits (allowlist empty = allow all)
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 3_000_000_000, ts::ctx(&mut scenario));
            assert!(vault::get_balance(&vault) == DEPOSIT_AMOUNT - 3_000_000_000);
            assert!(vault::get_spent_this_epoch(&vault) == 3_000_000_000);
            assert!(vault::get_tx_count_this_epoch(&vault) == 1);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 3: Exceeds per-tx limit aborts ========

    #[test]
    #[expected_failure(abort_code = agent_wall::vault::EExceedsPerTxLimit)]
    fun test_exceeds_per_tx_limit() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 11_000_000_000, ts::ctx(&mut scenario));
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 4: Exceeds daily limit aborts ========

    #[test]
    #[expected_failure(abort_code = agent_wall::vault::EExceedsDailyLimit)]
    fun test_exceeds_daily_limit() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Send multiple transfers to exhaust daily limit
        let mut i = 0;
        while (i < 10) {
            ts::next_tx(&mut scenario, AGENT);
            {
                let mut vault = ts::take_shared<Vault>(&scenario);
                vault::request_transfer(&mut vault, RECIPIENT, 5_000_000_000, ts::ctx(&mut scenario));
                ts::return_shared(vault);
            };
            i = i + 1;
        };

        // This should fail: spent=50 SUI, trying to send 5 more
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 5_000_000_000, ts::ctx(&mut scenario));
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 5: Denylisted recipient aborts ========

    #[test]
    #[expected_failure(abort_code = agent_wall::vault::ERecipientDenylisted)]
    fun test_denylisted_recipient() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Owner adds DENIED_ADDR to denylist
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::add_to_denylist(&mut vault, DENIED_ADDR, ts::ctx(&mut scenario));
            ts::return_shared(vault);
        };

        // Agent tries to send to denied address
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, DENIED_ADDR, 1_000_000_000, ts::ctx(&mut scenario));
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 6: Above auto-approve queues ========

    #[test]
    fun test_above_auto_approve_queues() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Agent sends above auto-approve (5 SUI) but within per-tx (10 SUI)
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 8_000_000_000, ts::ctx(&mut scenario));
            // Should be queued, not executed
            assert!(vault::get_pending_count(&vault) == 1);
            assert!(vault::get_balance(&vault) == DEPOSIT_AMOUNT); // Balance unchanged
            assert!(vault::get_spent_this_epoch(&vault) == 0);     // Not spent yet
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 7: Non-allowlisted queues when allowlist non-empty ========

    #[test]
    fun test_non_allowlisted_queues() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Owner adds RECIPIENT to allowlist
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::add_to_allowlist(&mut vault, RECIPIENT, ts::ctx(&mut scenario));
            ts::return_shared(vault);
        };

        // Agent sends to unknown address (not in allowlist)
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, UNKNOWN_ADDR, 3_000_000_000, ts::ctx(&mut scenario));
            assert!(vault::get_pending_count(&vault) == 1);
            assert!(vault::get_balance(&vault) == DEPOSIT_AMOUNT);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 8: Empty allowlist allows all ========

    #[test]
    fun test_empty_allowlist_allows_all() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // No allowlist entries → any recipient is fine
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, UNKNOWN_ADDR, 3_000_000_000, ts::ctx(&mut scenario));
            // Should execute, not queue
            assert!(vault::get_pending_count(&vault) == 0);
            assert!(vault::get_balance(&vault) == DEPOSIT_AMOUNT - 3_000_000_000);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 9: Rate limit queues ========

    #[test]
    fun test_rate_limit_queues() {
        let mut scenario = ts::begin(OWNER);

        // Create vault with low rate limit (3 tx per epoch) and high daily limit
        ts::next_tx(&mut scenario, OWNER);
        {
            let deposit_coin = coin::mint_for_testing<SUI>(DEPOSIT_AMOUNT, ts::ctx(&mut scenario));
            vault::create_vault(
                AGENT,
                MAX_PER_TX,
                MAX_DAILY,
                AUTO_APPROVE,
                3, // max 3 tx per epoch
                deposit_coin,
                ts::ctx(&mut scenario),
            );
        };

        // Send 3 transfers to hit rate limit
        let mut i = 0;
        while (i < 3) {
            ts::next_tx(&mut scenario, AGENT);
            {
                let mut vault = ts::take_shared<Vault>(&scenario);
                vault::request_transfer(&mut vault, RECIPIENT, 1_000_000_000, ts::ctx(&mut scenario));
                ts::return_shared(vault);
            };
            i = i + 1;
        };

        // 4th transfer should be queued
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 1_000_000_000, ts::ctx(&mut scenario));
            assert!(vault::get_pending_count(&vault) == 1);
            assert!(vault::get_tx_count_this_epoch(&vault) == 3); // Still 3, queued doesn't count
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 10: Owner approves pending tx ========

    #[test]
    fun test_approve_pending() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Agent sends above auto-approve → queued
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 8_000_000_000, ts::ctx(&mut scenario));
            assert!(vault::get_pending_count(&vault) == 1);
            ts::return_shared(vault);
        };

        // Owner approves pending tx (id = 0)
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::approve_pending(&mut vault, 0, ts::ctx(&mut scenario));
            assert!(vault::get_pending_count(&vault) == 0);
            assert!(vault::get_balance(&vault) == DEPOSIT_AMOUNT - 8_000_000_000);
            assert!(vault::get_spent_this_epoch(&vault) == 8_000_000_000);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 11: Owner rejects pending tx ========

    #[test]
    fun test_reject_pending() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Agent sends above auto-approve → queued
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 8_000_000_000, ts::ctx(&mut scenario));
            assert!(vault::get_pending_count(&vault) == 1);
            ts::return_shared(vault);
        };

        // Owner rejects pending tx
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::reject_pending(&mut vault, 0, ts::ctx(&mut scenario));
            assert!(vault::get_pending_count(&vault) == 0);
            assert!(vault::get_balance(&vault) == DEPOSIT_AMOUNT); // Balance unchanged
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 12: Non-owner cannot approve ========

    #[test]
    #[expected_failure(abort_code = agent_wall::vault::ENotOwner)]
    fun test_non_owner_cannot_approve() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Agent sends above auto-approve → queued
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 8_000_000_000, ts::ctx(&mut scenario));
            ts::return_shared(vault);
        };

        // Stranger tries to approve
        ts::next_tx(&mut scenario, STRANGER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::approve_pending(&mut vault, 0, ts::ctx(&mut scenario));
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 13: Non-agent cannot request transfer ========

    #[test]
    #[expected_failure(abort_code = agent_wall::vault::ENotAgent)]
    fun test_non_agent_cannot_transfer() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        ts::next_tx(&mut scenario, STRANGER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 1_000_000_000, ts::ctx(&mut scenario));
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 14: Epoch reset (indirect test) ========
    // Note: test_scenario doesn't easily support epoch changes,
    // but we test that counters track correctly within an epoch.

    #[test]
    fun test_counters_track_correctly() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Send 3 transfers
        let mut i = 0;
        while (i < 3) {
            ts::next_tx(&mut scenario, AGENT);
            {
                let mut vault = ts::take_shared<Vault>(&scenario);
                vault::request_transfer(&mut vault, RECIPIENT, 2_000_000_000, ts::ctx(&mut scenario));
                ts::return_shared(vault);
            };
            i = i + 1;
        };

        ts::next_tx(&mut scenario, AGENT);
        {
            let vault = ts::take_shared<Vault>(&scenario);
            assert!(vault::get_spent_this_epoch(&vault) == 6_000_000_000);
            assert!(vault::get_tx_count_this_epoch(&vault) == 3);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 15: Owner can update limits ========

    #[test]
    fun test_update_limits() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::update_limits(
                &mut vault,
                20_000_000_000,  // new max_per_tx
                100_000_000_000, // new max_daily
                10_000_000_000,  // new auto_approve
                50,              // new max_tx_per_epoch
                ts::ctx(&mut scenario),
            );
            assert!(vault::get_max_per_tx(&vault) == 20_000_000_000);
            assert!(vault::get_max_daily(&vault) == 100_000_000_000);
            assert!(vault::get_auto_approve_limit(&vault) == 10_000_000_000);
            assert!(vault::get_max_tx_per_epoch(&vault) == 50);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 16: Denylist and allowlist management ========

    #[test]
    fun test_list_management() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Add to denylist and allowlist
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::add_to_denylist(&mut vault, DENIED_ADDR, ts::ctx(&mut scenario));
            vault::add_to_allowlist(&mut vault, RECIPIENT, ts::ctx(&mut scenario));
            assert!(vault::get_denylist_length(&vault) == 1);
            assert!(vault::get_allowlist_length(&vault) == 1);
            ts::return_shared(vault);
        };

        // Remove from denylist and allowlist
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::remove_from_denylist(&mut vault, DENIED_ADDR, ts::ctx(&mut scenario));
            vault::remove_from_allowlist(&mut vault, RECIPIENT, ts::ctx(&mut scenario));
            assert!(vault::get_denylist_length(&vault) == 0);
            assert!(vault::get_allowlist_length(&vault) == 0);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test 17: Deposit and withdraw ========

    #[test]
    fun test_deposit_and_withdraw() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Deposit more
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            let extra = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario));
            vault::deposit(&mut vault, extra, ts::ctx(&mut scenario));
            assert!(vault::get_balance(&vault) == 150_000_000_000);
            ts::return_shared(vault);
        };

        // Withdraw some
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::withdraw(&mut vault, 30_000_000_000, ts::ctx(&mut scenario));
            assert!(vault::get_balance(&vault) == 120_000_000_000);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test: Set agent and revoke agent ========

    #[test]
    fun test_set_and_revoke_agent() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Set new agent
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::set_agent(&mut vault, STRANGER, ts::ctx(&mut scenario));
            assert!(vault::get_agent(&vault) == STRANGER);
            ts::return_shared(vault);
        };

        // Revoke agent
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::revoke_agent(&mut vault, ts::ctx(&mut scenario));
            assert!(vault::get_agent(&vault) == @0x0);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test: Invalid amount (0) aborts ========

    #[test]
    #[expected_failure(abort_code = agent_wall::vault::EInvalidAmount)]
    fun test_zero_amount_aborts() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 0, ts::ctx(&mut scenario));
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }

    // ======== Test: Allowlisted recipient succeeds when allowlist is non-empty ========

    #[test]
    fun test_allowlisted_succeeds() {
        let mut scenario = ts::begin(OWNER);
        create_test_vault(&mut scenario);

        // Add RECIPIENT to allowlist
        ts::next_tx(&mut scenario, OWNER);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::add_to_allowlist(&mut vault, RECIPIENT, ts::ctx(&mut scenario));
            ts::return_shared(vault);
        };

        // Transfer to allowlisted recipient within auto-approve
        ts::next_tx(&mut scenario, AGENT);
        {
            let mut vault = ts::take_shared<Vault>(&scenario);
            vault::request_transfer(&mut vault, RECIPIENT, 3_000_000_000, ts::ctx(&mut scenario));
            assert!(vault::get_pending_count(&vault) == 0);
            assert!(vault::get_balance(&vault) == DEPOSIT_AMOUNT - 3_000_000_000);
            ts::return_shared(vault);
        };

        ts::end(scenario);
    }
}
