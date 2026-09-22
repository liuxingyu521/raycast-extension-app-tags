import { useState } from "react";
import {
  Action,
  ActionPanel,
  Alert,
  Application,
  confirmAlert,
  Icon,
  List,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import {
  addTag,
  appId,
  clearTags,
  getTagsFor,
  normalizeTag,
  readTagMap,
  removeTag,
} from "./lib/tags";
import { colorForTag } from "./lib/colors";

/** 单个应用的标签编辑页：列出标签、添加、删除、清空 */
export function EditTags({
  app,
  onChange,
}: {
  app: Application;
  onChange?: () => void;
}) {
  const id = appId(app);
  const { data: tags, isLoading, revalidate } = usePromise(getTagsFor, [id]);
  const [searchText, setSearchText] = useState("");

  const filtered = (tags ?? []).filter((t) =>
    t.toLowerCase().includes(searchText.toLowerCase()),
  );

  /** 本页刷新 + 同步通知上一级（标签详情/搜索列表） */
  function refreshAll() {
    revalidate();
    onChange?.();
  }

  async function handleRemove(tag: string) {
    await removeTag(id, tag);
    await showToast({
      style: Toast.Style.Success,
      title: `已删除标签 “${tag}”`,
    });
    refreshAll();
  }

  async function handleClearAll() {
    if (
      await confirmAlert({
        title: `清空 ${app.name} 的所有标签？`,
        primaryAction: { title: "清空", style: Alert.ActionStyle.Destructive },
      })
    ) {
      await clearTags(id);
      await showToast({ style: Toast.Style.Success, title: "已清空标签" });
      refreshAll();
    }
  }

  return (
    <List
      isLoading={isLoading}
      navigationTitle={`标签管理 — ${app.name}`}
      searchBarPlaceholder="筛选标签…"
      onSearchTextChange={setSearchText}
      filtering={false}
    >
      {filtered.map((tag) => (
        <List.Item
          key={tag}
          icon={{ source: Icon.Tag, tintColor: colorForTag(tag) }}
          title={tag}
          actions={
            <ActionPanel>
              <Action.Push
                title="添加标签"
                icon={Icon.Plus}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
                target={<AddTagForm app={app} onDone={refreshAll} />}
              />
              <Action
                title="删除标签"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["ctrl"], key: "x" }}
                onAction={() => handleRemove(tag)}
              />
              <Action
                title="清空所有标签"
                icon={Icon.ExclamationMark}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
                onAction={handleClearAll}
              />
              <Action.CopyToClipboard
                title="复制标签"
                content={tag}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
            </ActionPanel>
          }
        />
      ))}
      {!isLoading && filtered.length === 0 && (
        <List.EmptyView
          icon={Icon.Tag}
          title={tags && tags.length > 0 ? "没有匹配的标签" : "还没有标签"}
          description="按 ⌘T 为这个应用添加一个别名标签，例如 docker、设计、办公"
          actions={
            <ActionPanel>
              <Action.Push
                title="添加标签"
                icon={Icon.Plus}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
                target={<AddTagForm app={app} onDone={refreshAll} />}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}

/** 添加标签：搜索栏过滤已有标签；输入无精确匹配时，第一项为「新建标签」 */
export function AddTagForm({
  app,
  onDone,
}: {
  app: Application;
  onDone?: () => void;
}) {
  const { pop } = useNavigation();
  const id = appId(app);
  const [searchText, setSearchText] = useState("");

  // 所有已存在的标签（排除当前应用已有的，避免重复添加）
  const { data: candidateTags, isLoading } = usePromise(async () => {
    const [map, mine] = await Promise.all([readTagMap(), getTagsFor(id)]);
    const mineLower = new Set(mine.map((t) => t.toLowerCase()));
    return [...new Set(Object.values(map).flat())]
      .filter((t) => !mineLower.has(t.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  });

  const query = normalizeTag(searchText);
  const queryLower = query.toLowerCase();
  const filtered = (candidateTags ?? []).filter((t) =>
    t.toLowerCase().includes(queryLower),
  );
  const exactExists = (candidateTags ?? []).some(
    (t) => t.toLowerCase() === queryLower,
  );
  const showCreate = query.length > 0 && !exactExists;

  async function pick(tag: string) {
    const ok = await addTag(id, tag);
    if (!ok) {
      await showToast({
        style: Toast.Style.Failure,
        title: "标签为空或已存在",
      });
      return;
    }
    await showToast({
      style: Toast.Style.Success,
      title: `已添加标签 “${normalizeTag(tag)}”`,
      message: app.name,
    });
    onDone?.();
    pop();
  }

  return (
    <List
      isLoading={isLoading}
      navigationTitle={`添加标签 — ${app.name}`}
      searchBarPlaceholder="搜索已有标签，或输入新标签名…"
      onSearchTextChange={setSearchText}
      filtering={false}
    >
      {showCreate && (
        <List.Item
          key="__create__"
          icon={{ source: Icon.Plus, tintColor: "#30D158" }}
          title={`新建标签 “${query}”`}
          actions={
            <ActionPanel>
              <Action
                title="新建并添加"
                icon={Icon.Plus}
                onAction={() => pick(query)}
              />
            </ActionPanel>
          }
        />
      )}
      {filtered.length > 0 && (
        <List.Section title="已有标签">
          {filtered.map((t) => (
            <List.Item
              key={t}
              icon={{ source: Icon.Tag, tintColor: colorForTag(t) }}
              title={t}
              actions={
                <ActionPanel>
                  <Action
                    title={`添加标签 “${t}”`}
                    icon={Icon.Plus}
                    onAction={() => pick(t)}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
      {!isLoading && filtered.length === 0 && !showCreate && (
        <List.EmptyView
          icon={Icon.Tag}
          title="没有可选标签"
          description="在上方输入新标签名，回车即可创建"
        />
      )}
    </List>
  );
}
