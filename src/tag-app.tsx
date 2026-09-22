import { useState } from "react";
import {
  Action,
  ActionPanel,
  Application,
  Icon,
  List,
  getApplications,
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

async function load(): Promise<AppEntry[]> {
  const [apps, tagMap] = await Promise.all([getApplications(), readTagMap()]);
  return apps
    .map((app) => {
      const id = appId(app);
      return { app, id, tags: tagMap[id] ?? [] };
    })
    .sort((a, b) => a.app.name.localeCompare(b.app.name));
}

/**
 * 快速打标专用命令：搜索应用，回车直接进入「搜索或新建标签」。
 * 建议配合全局快捷键或别名使用。
 */
export default function Command() {
  const { data, isLoading, revalidate } = usePromise(load);
  const [searchText, setSearchText] = useState("");

  const query = searchText.trim().toLowerCase();
  const results = (data ?? []).filter(
    (e) =>
      !query ||
      e.app.name.toLowerCase().includes(query) ||
      e.tags.some((t) => t.toLowerCase().includes(query)),
  );

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="输入应用名，回车直接打标签…"
      onSearchTextChange={setSearchText}
      filtering={false}
    >
      {results.map((entry) => (
        <List.Item
          key={entry.id}
          icon={{ fileIcon: entry.app.path }}
          title={entry.app.name}
          accessories={entry.tags.map((tag) => ({
            tag: { value: tag, color: colorForTag(tag) },
          }))}
          actions={
            <ActionPanel>
              <Action.Push
                title="打标签（搜索或新建）"
                icon={Icon.Tag}
                target={<AddTagForm app={entry.app} onDone={revalidate} />}
              />
              <Action.Push
                title="管理所有标签"
                icon={Icon.Pencil}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
                target={<EditTags app={entry.app} onChange={revalidate} />}
              />
              <ActionPanel.Section>
                <Action.ShowInFinder
                  path={entry.app.path}
                  shortcut={{ modifiers: ["cmd"], key: "f" }}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
      {!isLoading && results.length === 0 && (
        <List.EmptyView
          icon={Icon.MagnifyingGlass}
          title="没有匹配的应用"
          description="换个关键词试试"
        />
      )}
    </List>
  );
}
