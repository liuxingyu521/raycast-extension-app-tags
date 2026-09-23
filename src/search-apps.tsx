import { useMemo, useState } from "react";
import {
  Action,
  ActionPanel,
  Application,
  Icon,
  LaunchProps,
  List,
  closeMainWindow,
  getApplications,
  open,
  Keyboard,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { appId, readTagMap } from "./lib/tags";
import { colorForTag } from "./lib/colors";
import { AddTagForm, EditTags } from "./edit-tags";

interface AppEntry {
  app: Application;
  id: string;
  tags: string[];
}

async function loadEntries(): Promise<AppEntry[]> {
  const [apps, tagMap] = await Promise.all([getApplications(), readTagMap()]);
  return apps
    .map((app) => {
      const id = appId(app);
      return { app, id, tags: tagMap[id] ?? [] };
    })
    .sort((a, b) => a.app.name.localeCompare(b.app.name));
}

/** 每个搜索词都必须命中应用名或某个标签 */
function matches(entry: AppEntry, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystacks = [entry.app.name, ...entry.tags].map((s) => s.toLowerCase());
  return terms.every((t) => haystacks.some((h) => h.includes(t)));
}

/** 排序分：标签精确命中 > 名称开头匹配 > 标签包含 > 名称包含 */
function score(entry: AppEntry, terms: string[]): number {
  const name = entry.app.name.toLowerCase();
  const tags = entry.tags.map((t) => t.toLowerCase());
  let s = 0;
  for (const t of terms) {
    if (tags.includes(t)) s += 100;
    else if (name.startsWith(t)) s += 50;
    else if (tags.some((x) => x.includes(t))) s += 30;
    else if (name.includes(t)) s += 10;
  }
  return s;
}

interface CommandProps {
  arguments: { query: string };
  /** 作为主搜索回退命令（Fallback Command）启动时，Raycast 会把已输入的文字放在这里 */
  launchContext?: { fallbackText?: string };
}

export default function Command(props: LaunchProps<CommandProps>) {
  const initialQuery =
    props.arguments.query || props.launchContext?.fallbackText || "";
  const [searchText, setSearchText] = useState(initialQuery);
  const { data: entries, isLoading, revalidate } = usePromise(loadEntries);

  const terms = useMemo(
    () => searchText.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [searchText],
  );

  const results = useMemo(() => {
    const all = (entries ?? []).filter((e) => matches(e, terms));
    if (terms.length > 0) {
      all.sort(
        (a, b) =>
          score(b, terms) - score(a, terms) ||
          a.app.name.localeCompare(b.app.name),
      );
    }
    return all;
  }, [entries, terms]);

  const searching = terms.length > 0;
  const tagged = searching ? results : results.filter((e) => e.tags.length > 0);
  const untagged = searching ? [] : results.filter((e) => e.tags.length === 0);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="输入应用名或标签，例如 docker…"
      onSearchTextChange={setSearchText}
      filtering={false}
    >
      <List.Section title={searching ? "搜索结果" : "已打标签"}>
        {tagged.map((entry) => (
          <AppItem key={entry.id} entry={entry} revalidate={revalidate} />
        ))}
      </List.Section>
      {!searching && (
        <List.Section title="全部应用">
          {untagged.map((entry) => (
            <AppItem key={entry.id} entry={entry} revalidate={revalidate} />
          ))}
        </List.Section>
      )}
      {!isLoading && results.length === 0 && (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="没有匹配的应用"
          description="换个关键词试试，或在应用上按 ⌘T 添加标签"
        />
      )}
    </List>
  );
}

function AppItem({
  entry,
  revalidate,
}: {
  entry: AppEntry;
  revalidate: () => void;
}) {
  const { app, tags } = entry;
  return (
    <List.Item
      icon={{ fileIcon: app.path }}
      title={app.name}
      accessories={tags.map((tag) => ({
        tag: { value: tag, color: colorForTag(tag) },
      }))}
      actions={
        <ActionPanel>
          <Action
            title={`启动 ${app.name}`}
            icon={Icon.ArrowRight}
            onAction={async () => {
              await closeMainWindow();
              await open(app.path);
            }}
          />
          <Action.Push
            title="添加标签"
            icon={Icon.Tag}
            shortcut={{ modifiers: ["cmd"], key: "t" }}
            target={<AddTagForm app={app} onDone={revalidate} />}
          />
          <Action.Push
            title="管理所有标签"
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd", "shift"], key: "t" }}
            target={<EditTags app={app} onChange={revalidate} />}
          />
          <ActionPanel.Section>
            <Action.ShowInFinder
              path={app.path}
              shortcut={{ modifiers: ["cmd"], key: "f" }}
            />
            <Action.CopyToClipboard
              title="复制应用名"
              content={app.name}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.CopyToClipboard
              title="复制应用路径"
              content={app.path}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}
