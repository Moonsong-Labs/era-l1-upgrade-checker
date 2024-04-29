import type { VerifierContract } from "./verifier.js";
import path from "node:path";
import type { AbiSet } from "./abi-set.js";
import CliTable from "cli-table3";
import type { ContractData } from "./zk-sync-era-state.js";
import type { BlockExplorerClient } from "./block-explorer-client.js";
import type { SystemContractData } from "./upgrade-changes.js";

export class ZkSyncEraDiff {
  private oldVersion: string;
  private newVersion: string;
  private orphanedSelectors: string[];
  facetChanges: {
    oldAddress: string;
    newAddress: string;
    name: string;
    oldData: ContractData;
    newData: ContractData;
    oldSelectors: string[];
    newSelectors: string[];
  }[];

  private systemContractChanges: Array<{
    current: SystemContractData;
    proposed: SystemContractData;
  }>;

  private oldVerifier: VerifierContract;
  private newVerifier: VerifierContract;

  constructor(
    oldVersion: string,
    newVersion: string,
    orphanedSelectors: string[],
    oldVerifier: VerifierContract,
    newVerifier: VerifierContract
  ) {
    this.oldVersion = oldVersion;
    this.newVersion = newVersion;
    this.orphanedSelectors = orphanedSelectors;
    this.facetChanges = [];
    this.systemContractChanges = [];
    this.oldVerifier = oldVerifier;
    this.newVerifier = newVerifier;
  }

  addFacet(
    oldAddress: string,
    newAddress: string,
    name: string,
    oldData: ContractData,
    newData: ContractData,
    oldSelectors: string[],
    newSelectors: string[]
  ): void {
    this.facetChanges.push({
      oldAddress,
      newAddress,
      name,
      oldData,
      newData,
      oldSelectors,
      newSelectors,
    });
  }

  addSystemContract(current: SystemContractData, proposed: SystemContractData) {
    this.systemContractChanges.push({
      current,
      proposed,
    });
  }

  async writeCodeDiff(
    baseDirPath: string,
    filter: string[],
    client: BlockExplorerClient
  ): Promise<void> {
    const baseDirOld = path.join(baseDirPath, "old");
    const baseDirNew = path.join(baseDirPath, "new");

    await this.writeFacets(filter, baseDirOld, baseDirNew);
    await this.writeVerifier(filter, baseDirOld, baseDirNew, client);
  }

  private async writeVerifier(
    filter: string[],
    baseDirOld: string,
    baseDirNew: string,
    client: BlockExplorerClient
  ) {
    if (filter.length === 0 || filter.includes("verifier")) {
      const oldVerifierPath = path.join(baseDirOld, "verifier");
      const oldVerifierCode = await this.oldVerifier.getCode(client);
      await oldVerifierCode.writeSources(oldVerifierPath);
      const newVerifierPath = path.join(baseDirNew, "verifier");
      const newVerifierCode = await this.newVerifier.getCode(client);
      await newVerifierCode.writeSources(newVerifierPath);
    }
  }

  private async writeFacets(filter: string[], baseDirOld: string, baseDirNew: string) {
    for (const { name, oldData, newData } of this.facetChanges) {
      if (filter.length > 0 && !filter.includes(`facet:${name}`)) {
        continue;
      }

      const dirOld = path.join(baseDirOld, "facets", name);
      const dirNew = path.join(baseDirNew, "facets", name);

      await oldData.writeSources(dirOld);
      await newData.writeSources(dirNew);
    }
  }

  async toCliReport(abis: AbiSet, upgradeDir: string): Promise<string> {
    const title = "Upgrade report:";
    const strings = [`${title}`, "=".repeat(title.length), ""];

    const metadataTable = new CliTable({
      head: ["Metadata"],
      style: { compact: true },
    });
    metadataTable.push(["Current protocol version", this.oldVersion]);
    metadataTable.push(["Proposed protocol version", this.newVersion]);
    strings.push(metadataTable.toString());

    strings.push("L1 Main contract Diamond upgrades:");
    if (this.facetChanges.length === 0) {
      strings.push("No diamond changes", "");
    }

    for (const change of this.facetChanges) {
      const table = new CliTable({
        head: [change.name],
        style: { compact: true },
      });

      table.push(["Current address", change.oldAddress]);
      table.push(["Upgrade address", change.newAddress]);
      table.push(["Proposed contract verified etherscan", "Yes"]);

      const newFunctions = await Promise.all(
        change.newSelectors
          .filter((s) => !change.oldSelectors.includes(s))
          .map(async (selector) => {
            await abis.fetch(change.newAddress);
            return abis.signatureForSelector(selector);
          })
      );
      table.push(["New Functions", newFunctions.length ? newFunctions.join(", ") : "None"]);

      const removedFunctions = await Promise.all(
        change.oldSelectors
          .filter((s) => this.orphanedSelectors.includes(s))
          .map(async (selector) => {
            await abis.fetch(change.newAddress);
            return abis.signatureForSelector(selector);
          })
      );

      table.push([
        "Removed functions",
        removedFunctions.length ? removedFunctions.join(", ") : "None",
      ]);
      table.push(["To compare code", `pnpm validate facet-diff ${upgradeDir} ${change.name}`]);

      strings.push(table.toString());
    }

    strings.push("", "Verifier:");
    const verifierTable = new CliTable({
      head: ["Attribute", "Current value", "Upgrade value"],
      style: { compact: true },
    });

    verifierTable.push(["Address", this.oldVerifier.address, this.newVerifier.address]);
    verifierTable.push([
      "Recursion node level VkHash",
      this.oldVerifier.recursionNodeLevelVkHash,
      this.newVerifier.recursionNodeLevelVkHash,
    ]);
    verifierTable.push([
      "Recursion circuits set VksHash",
      this.oldVerifier.recursionCircuitsSetVksHash,
      this.newVerifier.recursionCircuitsSetVksHash,
    ]);
    verifierTable.push([
      "Recursion leaf level VkHash",
      this.oldVerifier.recursionLeafLevelVkHash,
      this.newVerifier.recursionLeafLevelVkHash,
    ]);
    verifierTable.push([
      {
        content: "",
        colSpan: 3,
      },
    ]);
    verifierTable.push([
      "Show contract diff",
      {
        content: `pnpm validate verifier-diff ${upgradeDir}`,
        colSpan: 2,
      },
    ]);
    strings.push(verifierTable.toString(), "");

    strings.push("System contracts:");

    if (this.systemContractChanges.length > 0) {
      const sysContractTable = new CliTable({
        head: ["Name", "Address", "bytecode hashes"],
        // style: { compact: true },
      });

      for (const { current, proposed } of this.systemContractChanges) {
        sysContractTable.push(
          [
            { content: proposed.name, rowSpan: 2, vAlign: "center" },
            { content: current.address, rowSpan: 2, vAlign: "center" },
            `Current: ${current.codeHash}`,
          ],
          [`Proposed: ${proposed.codeHash}`]
        );
      }

      strings.push(sysContractTable.toString());
    } else {
      strings.push("No changes in system contracts");
    }

    return strings.join("\n");
  }
}