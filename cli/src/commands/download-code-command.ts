import { compareCurrentStateWith } from "../lib";

import { withSpinner } from "../lib/with-spinner.js";
import type { EnvBuilder } from "../lib/env-builder.js";
import { assertDirectoryExists } from "../lib/fs-utils.js";

export async function downloadCode(
  env: EnvBuilder,
  upgradeDirectory: string,
  targetDir: string,
  l1Filter: string[]
): Promise<void> {
  await assertDirectoryExists(targetDir);

  const l2Client = env.l2Client();
  const repo = await env.contractsRepo();

  const { diff, l1Client } = await withSpinner(
    () => compareCurrentStateWith(env, upgradeDirectory),
    "Gathering contract data"
  );

  await withSpinner(
    () => diff.writeCodeDiff(targetDir, l1Filter, l1Client, l2Client, repo),
    "Downloading source code"
  );
  console.log(`✅ Source code successfully downloaded in: ${targetDir}`);
}
