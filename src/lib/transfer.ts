import { runAppleScript } from "@raycast/utils";
import { readFile, writeFile } from "fs/promises";
import { normalizeTag, TagMap } from "./tags";

/** 导出文件的顶层结构 */
export interface TagsExportFile {
  version: 1;
  exportedAt: string;
  tags: TagMap;
}

export function serializeTagMap(map: TagMap): string {
  const file: TagsExportFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tags: map,
  };
  return JSON.stringify(file, null, 2);
}

/**
 * 解析并校验导入文件，返回清洗后的 TagMap；格式不对返回 null。
 * 兼容两种格式：带 version 的导出文件，或裸的 { appId: string[] }。
 */
export function parseTagMapFile(raw: string): TagMap | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const candidate: unknown =
    "tags" in parsed ? (parsed as TagsExportFile).tags : parsed;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }
  const map: TagMap = {};
  for (const [id, tags] of Object.entries(
    candidate as Record<string, unknown>,
  )) {
    if (!Array.isArray(tags)) continue;
    const cleaned = [
      ...new Set(
        tags
          .filter((t): t is string => typeof t === "string")
          .map(normalizeTag)
          .filter(Boolean),
      ),
    ];
    if (cleaned.length > 0) {
      map[id] = cleaned.sort((a, b) => a.localeCompare(b));
    }
  }
  return map;
}

/** 把 TagMap 导出为 JSON 文件；用户取消返回 false，成功返回 true */
export async function exportTagMapToFile(map: TagMap): Promise<boolean> {
  const path = await pickSavePath("app-tags.json");
  if (!path) return false;
  await writeFile(path, serializeTagMap(map), "utf-8");
  return true;
}

/** 弹出文件选择器并读取文件内容；用户取消返回 null */
export async function pickAndReadJsonFile(): Promise<{
  path: string;
  content: string;
} | null> {
  const path = await pickJsonFile();
  if (!path) return null;
  const content = await readFile(path, "utf-8");
  return { path, content };
}

function isUserCancelled(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("-128") ||
      err.message.toLowerCase().includes("cancel"))
  );
}

async function pickSavePath(defaultName: string): Promise<string | null> {
  try {
    const path = await runAppleScript(
      `POSIX path of (choose file name with prompt "导出标签到文件" default name "${defaultName}")`,
    );
    return path.trim();
  } catch (err) {
    if (isUserCancelled(err)) return null;
    throw err;
  }
}

async function pickJsonFile(): Promise<string | null> {
  try {
    const path = await runAppleScript(
      `POSIX path of (choose file with prompt "选择要导入的标签文件" of type {"public.json"})`,
    );
    return path.trim();
  } catch (err) {
    if (isUserCancelled(err)) return null;
    throw err;
  }
}
