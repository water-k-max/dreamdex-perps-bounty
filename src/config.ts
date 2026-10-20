import "dotenv/config";

type Hex = `0x${string}`;

function optionalAddress(value: string | undefined): Hex | undefined {
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Hex) : undefined;
}

function optionalKey(value: string | undefined): Hex | undefined {
  return value && /^0x[0-9a-fA-F]{64}$/.test(value) ? (value as Hex) : undefined;
}

export const config = {
  chainId: Number(process.env.CHAIN_ID ?? 50383),
  rpcUrl: process.env.RPC_URL ?? "https://api.hideki2.infra.testnet.somnia.network",
  wsUrl: process.env.WS_URL ?? "wss://api.hideki2.infra.testnet.somnia.network/ws",
  indexerUrl: process.env.INDEXER_URL ?? "https://hideki-dev.smk.somnia.host/v1/graphql",
  privateKey: optionalKey(process.env.PRIVATE_KEY),
  walletAddress: optionalAddress(process.env.WALLET_ADDRESS),
  ownerAddress: optionalAddress(process.env.OWNER_ADDRESS),
};
