/** 标签配色：同一标签名稳定映射到同一颜色，亮色/暗色主题下都清晰可读 */

const PALETTE = [
  "#0A84FF", // 蓝
  "#30D158", // 绿
  "#FF9F0A", // 橙
  "#BF5AF2", // 紫
  "#FF375F", // 粉
  "#64D2FF", // 青
  "#7D7AFF", // 靛
  "#FFD60A", // 黄
] as const;

/** djb2 哈希，保证同一标签在任何界面颜色一致 */
export function colorForTag(tag: string): string {
  let h = 5381;
  for (const ch of tag) {
    h = (h * 33 + (ch.codePointAt(0) ?? 0)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}
