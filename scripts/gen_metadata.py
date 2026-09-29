"""生成 Raycast Store metadata 封面图（2000x1250），风格与最新扩展图标一致。

深色底 + 青绿渐变光晕，直接使用 assets/icon.png 作为主体，
标签 chips 配色取自 src/lib/colors.ts 的 PALETTE。
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = "/Users/xj/Github/raycast-extension-app-tags/reat"
ICON = f"{ROOT}/assets/icon-transparent.png"  # 透明底图标，用于悬浮展示
OUT = f"{ROOT}/metadata/app-tags-1.png"
W, H = 2000, 1250

HELVETICA = "/System/Library/Fonts/Helvetica.ttc"           # index 1 = Bold
HIRAGINO_GB = "/System/Library/Fonts/Hiragino Sans GB.ttc"  # 简中，index 0 = W3, 1 = W6


def font(path, size, index=0):
    try:
        return ImageFont.truetype(path, size, index=index)
    except Exception:
        return ImageFont.load_default()


f_title = font(HELVETICA, 176, index=1)
f_sub = font(HIRAGINO_GB, 62, index=1)
f_chip = font(HIRAGINO_GB, 50, index=1)

# ---------- 背景：深色渐变 + 青绿光晕 ----------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# 对角深色渐变 (#12151a -> #1b2027)
t = (xx / W * 0.4 + yy / H * 0.6)
c0 = np.array([18, 21, 26], dtype=np.float32)
c1 = np.array([29, 34, 41], dtype=np.float32)
bg = c0[None, None, :] * (1 - t[..., None]) + c1[None, None, :] * t[..., None]


def add_glow(arr, cx, cy, radius, color, strength):
    """叠加一层柔和径向光晕"""
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / radius
    fall = np.clip(1 - d, 0, 1) ** 2 * strength
    col = np.array(color, dtype=np.float32)
    return arr + (col[None, None, :] - arr) * fall[..., None]


bg = add_glow(bg, W * 0.26, H * 0.50, 720, (45, 212, 168), 0.22)   # 图标后青绿主光晕
bg = add_glow(bg, W * 0.30, H * 0.24, 520, (96, 224, 130), 0.10)   # 上方偏绿
bg = add_glow(bg, W * 0.85, H * 0.90, 640, (10, 132, 255), 0.07)   # 右下淡淡蓝光呼应配色

# 四角轻微压暗（vignette）
dv = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
bg *= (1 - np.clip(dv - 0.55, 0, 1) * 0.35)[..., None]

img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

# ---------- 左侧：图标 + 投影 ----------
icon = Image.open(ICON).convert("RGBA").resize((600, 600), Image.LANCZOS)
ix, iy = 130, 300  # 左上角位置

shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
silhouette = icon.getchannel("A").point(lambda a: a * 0.55)
shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
shadow_layer.paste((8, 24, 20, 255), (ix + 6, iy + 26), silhouette)
shadow = shadow_layer.filter(ImageFilter.GaussianBlur(34))
img = Image.alpha_composite(img, shadow)
img.paste(icon, (ix, iy), icon)

d = ImageDraw.Draw(img)

# ---------- 右侧：标题与副标题 ----------
tx = 940
d.text((tx, 400), "App Tags", font=f_title, fill=(245, 247, 250))
d.text((tx, 660), "为应用打上自定义标签", font=f_sub, fill=(224, 231, 238))
d.text((tx, 752), "用你记得住的方式找到并启动它", font=f_sub, fill=(158, 170, 182))

# ---------- 底部：示例标签 chips（配色 = 应用内标签配色） ----------
chips = [("docker", "#0A84FF"), ("设计", "#30D158"), ("办公", "#FF9F0A"), ("效率", "#BF5AF2")]
overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
cx0, cy0 = tx, 900
chip_boxes = []
for c, col in chips:
    rgb = tuple(int(col[i : i + 2], 16) for i in (1, 3, 5))
    tw = d.textlength(c, font=f_chip)
    pad_x = 38
    bw, bh = int(tw + pad_x * 2), 92
    od.rounded_rectangle(
        [cx0, cy0, cx0 + bw, cy0 + bh],
        radius=bh // 2,
        fill=rgb + (38,),
        outline=rgb + (220,),
        width=3,
    )
    chip_boxes.append((c, rgb, cx0 + pad_x, cy0 + bh // 2))
    cx0 += bw + 30

img = Image.alpha_composite(img, overlay)
d = ImageDraw.Draw(img)
for c, rgb, x, y in chip_boxes:
    d.text((x, y), c, font=f_chip, fill=rgb, anchor="lm")

img.convert("RGB").save(OUT)
print("saved:", OUT)
