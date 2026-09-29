import { Application, LocalStorage } from "@raycast/api";

const STORAGE_KEY = "appTags.v1";

/** appId -> tags */
export type TagMap = Record<string, string[]>;

/** 用 bundleId 作为应用的稳定标识，取不到时退化为路径 */
export function appId(app: Application): string {
  return app.bundleId ?? app.path;
}

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ");
}

export async function readTagMap(): Promise<TagMap> {
  const raw = await LocalStorage.getItem<string>(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as TagMap;
    }
    return {};
  } catch {
    return {};
  }
}

async function writeTagMap(map: TagMap): Promise<void> {
  await LocalStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export async function getTagsFor(id: string): Promise<string[]> {
  const map = await readTagMap();
  return map[id] ?? [];
}

/** 返回 true 表示新增成功，false 表示标签已存在或为空 */
export async function addTag(id: string, tag: string): Promise<boolean> {
  const t = normalizeTag(tag);
  if (!t) return false;
  const map = await readTagMap();
  const existing = map[id] ?? [];
  if (existing.some((x) => x.toLowerCase() === t.toLowerCase())) {
    return false;
  }
  map[id] = [...existing, t].sort((a, b) => a.localeCompare(b));
  await writeTagMap(map);
  return true;
}

export async function removeTag(id: string, tag: string): Promise<void> {
  const map = await readTagMap();
  const next = (map[id] ?? []).filter((x) => x !== tag);
  if (next.length === 0) {
    delete map[id];
  } else {
    map[id] = next;
  }
  await writeTagMap(map);
}

export async function clearTags(id: string): Promise<void> {
  const map = await readTagMap();
  if (id in map) {
    delete map[id];
    await writeTagMap(map);
  }
}

/** 从所有应用上移除某个标签 */
export async function removeTagEverywhere(tag: string): Promise<void> {
  const map = await readTagMap();
  for (const id of Object.keys(map)) {
    const next = map[id].filter((x) => x !== tag);
    if (next.length === 0) {
      delete map[id];
    } else {
      map[id] = next;
    }
  }
  await writeTagMap(map);
}

/** 导入标签：merge 与现有标签合并（忽略大小写去重），replace 整体覆盖 */
export async function importTagMap(
  incoming: TagMap,
  mode: "merge" | "replace",
): Promise<void> {
  if (mode === "replace") {
    await writeTagMap(incoming);
    return;
  }
  const map = await readTagMap();
  for (const [id, tags] of Object.entries(incoming)) {
    const existing = map[id] ?? [];
    const seen = new Set(existing.map((t) => t.toLowerCase()));
    const merged = [...existing];
    for (const t of tags) {
      if (!seen.has(t.toLowerCase())) {
        merged.push(t);
        seen.add(t.toLowerCase());
      }
    }
    map[id] = merged.sort((a, b) => a.localeCompare(b));
  }
  await writeTagMap(map);
}

/** 全局重命名标签（合并同名标签，忽略大小写冲突） */
export async function renameTagEverywhere(
  oldTag: string,
  newTag: string,
): Promise<boolean> {
  const t = normalizeTag(newTag);
  if (!t || t === oldTag) return false;
  const map = await readTagMap();
  for (const id of Object.keys(map)) {
    if (map[id].includes(oldTag)) {
      const merged = new Set(map[id].map((x) => (x === oldTag ? t : x)));
      map[id] = [...merged].sort((a, b) => a.localeCompare(b));
    }
  }
  await writeTagMap(map);
  return true;
}
