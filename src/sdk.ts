import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { config } from "./config.js";

export function createMarkets(options: { withSigner?: boolean } = {}): SomniaMarkets {
  const withSigner = options.withSigner ?? Boolean(config.privateKey);
  if (withSigner && !config.privateKey) {
    throw new Error("PRIVATE_KEY is required for a signer-backed client");
  }
  return new SomniaMarkets({
    chain: hidekiTestnet,
    indexerUrl: config.indexerUrl,
    addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
    ...(withSigner && config.privateKey ? { privateKey: config.privateKey } : {}),
  });
}
