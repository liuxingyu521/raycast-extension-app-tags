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
  importTagMap,
  readTagMap,
  removeTag,
  removeTagEverywhere,
  renameTagEverywhere,
  TagMap,
} from "./lib/tags";
import {
  exportTagMapToFile,
  parseTagMapFile,
  pickAndReadJsonFile,
} from "./lib/transfer";
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

  async function handleExport() {
    const map = await readTagMap();
    if (Object.keys(map).length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "还没有任何标签可导出",
      });
      return;
    }
    const ok = await exportTagMapToFile(map);
    if (ok) {
      const tagCount = new Set(Object.values(map).flat()).size;
      await showToast({
        style: Toast.Style.Success,
        title: "导出完成",
        message: `${Object.keys(map).length} 个应用、${tagCount} 个标签`,
      });
    }
  }

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
                <TransferActions
                  onExport={handleExport}
                  onImported={revalidate}
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
          description="打开 “Search Applications” 命令，在任意应用上按 ⌘T 添加标签；或按 ⌘I 从文件导入"
          actions={
            <ActionPanel>
              <TransferActions
                onExport={handleExport}
                onImported={revalidate}
              />
            </ActionPanel>
          }
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

/** 导入 / 导出动作组，挂在列表项和空视图的动作面板上 */
function TransferActions({
  onExport,
  onImported,
}: {
  onExport: () => void;
  onImported: () => void;
}) {
  return (
    <ActionPanel.Section title="导入 / 导出">
      <Action
        title="导出标签到文件…"
        icon={Icon.Upload}
        shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
        onAction={onExport}
      />
      <Action.Push
        title="从文件导入标签…"
        icon={Icon.Download}
        shortcut={{ modifiers: ["cmd"], key: "i" }}
        target={<ImportTagsForm onDone={onImported} />}
      />
    </ActionPanel.Section>
  );
}

/** 导入标签：先选合并/覆盖方式，再弹文件选择器，导入前二次确认 */
function ImportTagsForm({ onDone }: { onDone?: () => void }) {
  const { pop } = useNavigation();

  return (
    <Form
      navigationTitle="导入标签"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="选择文件并导入"
            icon={Icon.Download}
            onSubmit={async (values: { mode: string }) => {
              const picked = await pickAndReadJsonFile();
              if (!picked) return; // 用户取消，留在表单
              const map = parseTagMapFile(picked.content);
              if (!map || Object.keys(map).length === 0) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "文件格式不正确",
                  message: "需要 App Tags 导出的 JSON 文件",
                });
                return;
              }
              const appCount = Object.keys(map).length;
              const tagCount = new Set(Object.values(map).flat()).size;
              const replace = values.mode === "replace";
              if (
                await confirmAlert({
                  title: `${replace ? "覆盖" : "合并"}导入 ${appCount} 个应用的标签？`,
                  message: `共 ${tagCount} 个不同标签。${replace ? "现有标签将被全部替换，此操作不可撤销。" : "将与现有标签合并，不会删除已有标签。"}`,
                  primaryAction: {
                    title: replace ? "覆盖导入" : "合并导入",
                    style: replace
                      ? Alert.ActionStyle.Destructive
                      : Alert.ActionStyle.Default,
                  },
                })
              ) {
                await importTagMap(map, values.mode as "merge" | "replace");
                await showToast({
                  style: Toast.Style.Success,
                  title: "导入完成",
                  message: `${appCount} 个应用、${tagCount} 个标签`,
                });
                onDone?.();
                pop();
              }
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="mode" title="导入方式" defaultValue="merge">
        <Form.Dropdown.Item
          value="merge"
          title="合并：保留现有标签，累加导入"
          icon={Icon.Plus}
        />
        <Form.Dropdown.Item
          value="replace"
          title="覆盖：清空现有标签后导入"
          icon={Icon.ExclamationMark}
        />
      </Form.Dropdown>
      <Form.Description text="选择由 App Tags 导出的 JSON 文件；应用按 bundleId 匹配，未安装的应用标签也会保留。" />
    </Form>
  );
}
