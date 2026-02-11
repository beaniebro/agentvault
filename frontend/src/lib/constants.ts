// Package ID — update after deployment
export const PACKAGE_ID = "0x4e064c7a2de2154802a38dce34d9b4610bac537a940c01ee90e432307f7f010a";

// Module name
export const MODULE_NAME = "vault";

// Walrus endpoints
export const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
export const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

// Sui network
export const SUI_NETWORK = "testnet";

// Conversion
export const MIST_PER_SUI = 1_000_000_000;

// Event types (fully qualified)
export const EVENT_TYPES = {
  VaultCreated: `${PACKAGE_ID}::${MODULE_NAME}::VaultCreated`,
  TransferExecuted: `${PACKAGE_ID}::${MODULE_NAME}::TransferExecuted`,
  TransferBlocked: `${PACKAGE_ID}::${MODULE_NAME}::TransferBlocked`,
  TransferQueued: `${PACKAGE_ID}::${MODULE_NAME}::TransferQueued`,
  TransferApproved: `${PACKAGE_ID}::${MODULE_NAME}::TransferApproved`,
  TransferRejected: `${PACKAGE_ID}::${MODULE_NAME}::TransferRejected`,
} as const;

export function getEventType(event: string): string {
  return `${PACKAGE_ID}::${MODULE_NAME}::${event}`;
}
