import { execFile } from "child_process";

export interface RunningApps {
  bundleIds: Set<string>;
  paths: Set<string>;
  names: Set<string>;
}

const EMPTY: RunningApps = {
  bundleIds: new Set(),
  paths: new Set(),
  names: new Set(),
};

function runLsAppInfo(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "/usr/bin/lsappinfo",
      ["list"],
      { maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      },
    );
  });
}

/**
 * 当前正在运行且有界面的应用集合（排除 BackgroundOnly 后台进程）。
 * 数据来自 macOS 自带的 lsappinfo，不经过 Apple Events，无需自动化授权。
 * 匹配优先级：bundleId > 应用路径 > 进程名；查询失败时返回空集。
 */
export async function getRunningApps(): Promise<RunningApps> {
  let output: string;
  try {
    output = await runLsAppInfo();
  } catch {
    return EMPTY;
  }

  const bundleIds = new Set<string>();
  const paths = new Set<string>();
  const names = new Set<string>();

  // 每个进程块以 ` 12) "Name" ASN:0x0-...: ` 开头
  for (const block of output.split(/^\s*\d+\) /m).slice(1)) {
    if (block.includes('type="BackgroundOnly"')) continue;

    const name = block.match(/^"([^"]+)"/)?.[1];
    const bundleId = block.match(/bundleID="([^"]+)"/)?.[1];
    const path = block.match(/bundle path="([^"]+)"/)?.[1];

    if (bundleId) bundleIds.add(bundleId);
    if (path) paths.add(path);
    if (name) names.add(name);
  }

  return { bundleIds, paths, names };
}
