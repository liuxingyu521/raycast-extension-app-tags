import { useState } from "react";
import {
  Action,
  ActionPanel,
  Alert,
  Application,
  Form,
  Icon,
  List,
  Toast,
  closeMainWindow,
  confirmAlert,
  getApplications,
  open,
  showToast,
  useNavigation,
  Keyboard,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
import {
  addTag,
  appId,
  readTagMap,
  removeTag,
  removeTagEverywhere,
  renameTagEverywhere,
  TagMap,
} from "./lib/tags";
import { colorForTag } from "./lib/colors";
import { EditTags } from "./edit-tags";

interface TagGroup {
  tag: string;
  apps: Application[];
}

interface OrphanEntry {
  id: string;
  tags: string[];
}

interface LoadResult {
  groups: TagGroup[];
  orphans: OrphanEntry[];
}

async function load(): Promise<LoadResult> {
  const [apps, tagMap] = await Promise.all([getApplications(), readTagMap()]);
  const byId = new Map<string, Application>(apps.map((a) => [appId(a), a]));

  const byTag = new Map<string, Application[]>();
  const orphans: OrphanEntry[] = [];
  for (const [id, tags] of Object.entries(tagMap as TagMap)) {
    if (!tags || tags.length === 0) continue;
    const app = byId.get(id);
    if (!app) {
      orphans.push({ id, tags });
      continue;
    }
    for (const tag of tags) {
      const list = byTag.get(tag) ?? [];
      list.push(app);
      byTag.set(tag, list);
    }
  }

  const groups: TagGroup[] = [...byTag.entries()]
    .map(([tag, tagApps]) => ({
      tag,
      apps: tagApps.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort(
      (a, b) => b.apps.length - a.apps.length || a.tag.localeCompare(b.tag),
    );

  return { groups, orphans };
}

export default function Command() {
  const { data, isLoading, revalidate } = usePromise(load);
  const groups = data?.groups ?? [];
  const orphans = data?.orphans ?? [];

  async function handleDeleteEverywhere(group: TagGroup) {
    if (
      await confirmAlert({
        title: `从所有应用上移除标签 “${group.tag}”？`,
        message: `影响 ${group.apps.length} 个应用：${group.apps.map((a) => a.name).join("、")}`,
        primaryAction: { title: "移除", style: Alert.ActionStyle.Destructive },
      })
    ) {
      await removeTagEverywhere(group.tag);
      await showToast({
        style: Toast.Style.Success,
        title: `已移除标签 “${group.tag}”`,
      });
      revalidate();
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="搜索标签…">
      <List.Section title={`全部标签（${groups.length}）`}>
        {groups.map((group) => (
          <List.Item
            key={group.tag}
            icon={{ source: Icon.Tag, tintColor: colorForTag(group.tag) }}
            title={group.tag}
            subtitle={group.apps.map((a) => a.name).join("、")}
            accessories={[
              {
                tag: {
                  value: `${group.apps.length} 个应用`,
                  color: colorForTag(group.tag),
                },
              },
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="查看该标签下的应用"
                  icon={Icon.AppWindowList}
                  target={<TagDetail tag={group.tag} onChange={revalidate} />}
                />
                <Action.Push
                  title="重命名标签"
                  icon={Icon.Pencil}
                  shortcut={Keyboard.Shortcut.Common.Refresh}
                  target={<RenameTagForm tag={group.tag} onDone={revalidate} />}
                />
                <Action
                  title="从所有应用移除该标签"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
                  onAction={() => handleDeleteEverywhere(group)}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {orphans.length > 0 && (
        <List.Section title={`已卸载应用的残留标签（${orphans.length}）`}>
          {orphans.map(({ id, tags }) => (
            <List.Item
              key={id}
              icon={Icon.QuestionMark}
              title={id}
              accessories={tags.map((tag) => ({
                tag: { value: tag, color: colorForTag(tag) },
              }))}
              actions={
                <ActionPanel>
                  <Action
                    title="删除残留标签"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={async () => {
                      const { clearTags } = await import("./lib/tags");
                      await clearTags(id);
                      await showToast({
                        style: Toast.Style.Success,
                        title: "已删除残留标签",
                      });
                      revalidate();
                    }}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
      {!isLoading && groups.length === 0 && orphans.length === 0 && (
        <List.EmptyView
          icon={Icon.Tag}
          title="还没有任何标签"
          description="打开 “Search Applications” 命令，在任意应用上按 ⌘T 添加标签"
        />
      )}
    </List>
  );
}

/** 某个标签下的应用列表 */
function TagDetail({ tag, onChange }: { tag: string; onChange?: () => void }) {
  const { data, isLoading, revalidate } = usePromise(load);
  const group = data?.groups.find((g) => g.tag === tag);

  /** 详情页自身刷新 + 同步刷新上一级标签总览 */
  function refreshAll() {
    revalidate();
    onChange?.();
  }

  async function handleRemove(app: Application) {
    await removeTag(appId(app), tag);
    await showToast({
      style: Toast.Style.Success,
      title: `已从 ${app.name} 移除标签 “${tag}”`,
    });
    refreshAll();
  }

  return (
    <List
      isLoading={isLoading}
      navigationTitle={`标签 “${tag}”`}
      searchBarPlaceholder="搜索应用…"
    >
      {group?.apps.map((app) => (
        <List.Item
          key={appId(app)}
          icon={{ fileIcon: app.path }}
          title={app.name}
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
                title="把应用加入此标签"
                icon={Icon.Plus}
                shortcut={Keyboard.Shortcut.Common.New}
                target={<AddAppsToTag tag={tag} onDone={refreshAll} />}
              />
              <Action.Push
                title="管理该应用的所有标签"
                icon={Icon.Tag}
                shortcut={{ modifiers: ["cmd"], key: "t" }}
                target={<EditTags app={app} onChange={refreshAll} />}
              />
              <Action
                title={`从此应用移除标签 “${tag}”`}
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={{ modifiers: ["ctrl"], key: "x" }}
                onAction={() => handleRemove(app)}
              />
              <ActionPanel.Section>
                <Action.ShowInFinder
                  path={app.path}
                  shortcut={{ modifiers: ["cmd"], key: "f" }}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
      {!isLoading && !group && (
        <List.EmptyView
          icon={Icon.Tag}
          title="该标签下已经没有应用了"
          description="按 ⌘N 把应用加入这个标签"
          actions={
            <ActionPanel>
              <Action.Push
                title="把应用加入此标签"
                icon={Icon.Plus}
                shortcut={Keyboard.Shortcut.Common.New}
                target={<AddAppsToTag tag={tag} onDone={refreshAll} />}
              />
            </ActionPanel>
          }
        />
      )}
    </List>
  );
}

/** 反向打标：搜索还没有该标签的应用，回车加入（可连续添加多个） */
function AddAppsToTag({ tag, onDone }: { tag: string; onDone?: () => void }) {
  const [searchText, setSearchText] = useState("");

  // 所有尚未拥有该标签的应用
  const {
    data: candidates,
    isLoading,
    revalidate,
  } = usePromise(async () => {
    const [apps, tagMap] = await Promise.all([getApplications(), readTagMap()]);
    return apps
      .filter(
        (a) =>
          !(tagMap[appId(a)] ?? []).some(
            (t) => t.toLowerCase() === tag.toLowerCase(),
          ),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const query = searchText.trim().toLowerCase();
  const filtered = (candidates ?? []).filter((a) =>
    a.name.toLowerCase().includes(query),
  );

  async function handleAdd(app: Application) {
    await addTag(appId(app), tag);
    await showToast({
      style: Toast.Style.Success,
      title: `已把 ${app.name} 加入标签 “${tag}”`,
    });
    revalidate(); // 刷新候选列表，已加入的应用消失
    onDone?.(); // 同步刷新上一级的标签详情页
  }

  return (
    <List
      isLoading={isLoading}
      navigationTitle={`加入标签 “${tag}”`}
      searchBarPlaceholder="搜索要加入的应用…"
      onSearchTextChange={setSearchText}
      filtering={false}
    >
      {filtered.map((app) => (
        <List.Item
          key={appId(app)}
          icon={{ fileIcon: app.path }}
          title={app.name}
          actions={
            <ActionPanel>
              <Action
                title={`加入标签 “${tag}”`}
                icon={Icon.Plus}
                onAction={() => handleAdd(app)}
              />
              <ActionPanel.Section>
                <Action.ShowInFinder
                  path={app.path}
                  shortcut={{ modifiers: ["cmd"], key: "f" }}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
      {!isLoading && filtered.length === 0 && (
        <List.EmptyView
          icon={Icon.Checkmark}
          title={query ? "没有匹配的应用" : "所有应用都已拥有该标签"}
          description={query ? "换个关键词试试" : "按 Esc 返回"}
        />
      )}
    </List>
  );
}

/** 全局重命名标签 */
function RenameTagForm({ tag, onDone }: { tag: string; onDone?: () => void }) {
  const { pop } = useNavigation();
  const [nameError, setNameError] = useState<string | undefined>();

  return (
    <Form
      navigationTitle={`重命名标签 “${tag}”`}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="重命名"
            icon={Icon.Pencil}
            onSubmit={async (values: { name: string }) => {
              const ok = await renameTagEverywhere(tag, values.name);
              if (!ok) {
                setNameError("名称为空或与原标签相同");
                return;
              }
              await showToast({
                style: Toast.Style.Success,
                title: `已重命名为 “${values.name.trim()}”`,
              });
              onDone?.();
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="新名称"
        defaultValue={tag}
        error={nameError}
        onChange={() => setNameError(undefined)}
      />
      <Form.Description text="会在所有应用上同步重命名该标签；如果新名称已存在，会自动合并。" />
    </Form>
  );
}
