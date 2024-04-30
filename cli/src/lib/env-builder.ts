import { BlockExplorerClient } from "./block-explorer-client.js";
import type { Network } from "./constants.js";
import { GithubClient } from "./github-client.js";
import { RpcClient } from "./rpc-client.js";

export class EnvBuilder {
  private _etherscanApiKey?: string;
  githubApiKey?: string;
  rpcUrl?: string;
  private _network?: Network;

  private _l1Client?: BlockExplorerClient;
  private _l2Client?: BlockExplorerClient;
  private _github?: GithubClient;

  // Config

  withNetwork(n: Network): void {
    this._network = n;
  }

  withEtherscanApiKey(etherscanKey: string): void {
    this._etherscanApiKey = etherscanKey;
  }

  withGithubApiKey(maybeKey: string | undefined): void {
    this.githubApiKey = maybeKey;
  }

  withRpcUrl(maybeUrl: string | undefined): void {
    this.rpcUrl = maybeUrl;
  }

  // Get components

  get network(): Network {
    if (!this._network) {
      throw new Error("Missing network");
    }
    return this._network;
  }

  get etherscanApiKey(): string {
    if (!this._etherscanApiKey) {
      throw new Error("Missing etherscan key");
    }
    return this._etherscanApiKey;
  }

  l1Client(): BlockExplorerClient {
    if (this._l1Client) {
      return this._l1Client;
    }

    this._l1Client = BlockExplorerClient.fromNetwork(this.etherscanApiKey, this.network);
    return this._l1Client;
  }

  l2Client(): BlockExplorerClient {
    if (this._l2Client) {
      return this._l2Client;
    }
    this._l2Client = BlockExplorerClient.forL2(this.network);
    return this._l2Client;
  }

  github(): GithubClient {
    if (this._github) {
      return this._github;
    }

    this._github = new GithubClient(this.githubApiKey);
    return this._github;
  }

  rpc(): RpcClient {
    return new RpcClient(this.network, this.rpcUrl);
  }
}