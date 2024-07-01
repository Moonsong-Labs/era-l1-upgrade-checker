import {
  BlockExplorerClient,
  ObjectCheckReport,
  RpcClient,
  ZkSyncEraDiff,
  ZksyncEraState,
  CheckReportObj
} from "validate-cli";
import * as fs from "node:fs/promises";
import * as path from "node:path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


export async function checkReport(_reportId: string): Promise<CheckReportObj> {
  const network = "mainnet";
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new Error("No api key");
  }
  const l1Explorer = BlockExplorerClient.forL1(apiKey, network);
  const l2Explorer = BlockExplorerClient.forL2(network);
  const l1Rpc = RpcClient.forL1(network);
  const current = await ZksyncEraState.fromBlockchain(network, l1Explorer, l1Rpc);

  const rawBuf = await fs.readFile(path.join(__dirname, "mock-upgrade.hex"))
  const decodedBuf = Buffer.from(rawBuf.toString(), "hex");

  const [proposed, sysAddresses] = await ZksyncEraState.fromCalldata(
    decodedBuf,
    network,
    l1Explorer,
    l1Rpc,
    l2Explorer
  );

  const diff = new ZkSyncEraDiff(current, proposed, sysAddresses);
  const report = new ObjectCheckReport(diff, l1Explorer);
  return report.format();
}
