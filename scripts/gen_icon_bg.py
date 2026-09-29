"""给扩展图标加背景：毛玻璃风格（浅色磨砂底 + 柔和彩色光斑 + 细噪点）。

输入 assets/icon-transparent.png（透明底原始图标），输出覆盖 assets/icon.png。
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = "/Users/xj/Github/raycast-extension-app-tags/reat"
SRC = f"{ROOT}/assets/icon-transparent.png"
OUT = f"{ROOT}/assets/icon.png"
SIZE = 512
ICON_SCALE = 0.86  # 图标占画布比例，四周留出呼吸空间

rng = np.random.default_rng(20260929)
yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)

# ---------- 底层：柔和彩色光斑（取自标签配色） ----------
# 低分辨率随机场插值放大，形成自然的大块柔和色斑
LOW = 6
palette = np.array(
    [
        [168, 235, 210],  # 浅青绿
        [150, 220, 245],  # 浅青蓝
        [190, 245, 200],  # 浅绿
        [200, 210, 250],  # 浅靛蓝
        [235, 245, 235],  # 近白绿
    ],
    dtype=np.float32,
)
field = palette[rng.integers(0, len(palette), size=(LOW, LOW))]
blobs = Image.fromarray(field.astype(np.uint8), "RGB").resize(
    (SIZE, SIZE), Image.BICUBIC
)
blobs = blobs.filter(ImageFilter.GaussianBlur(60))
bg = np.asarray(blobs, dtype=np.float32)

# 中心补一层亮青绿光晕，让标签后方更通透
d = np.sqrt((xx - SIZE * 0.45) ** 2 + (yy - SIZE * 0.42) ** 2) / (SIZE * 0.55)
fall = np.clip(1 - d, 0, 1) ** 2 * 0.25
glow = np.array([200, 245, 225], dtype=np.float32)
bg = bg + (glow[None, None, :] - bg) * fall[..., None]

# ---------- 磨砂层：半透明白 + 顶部高光 + 细噪点 ----------
frost = np.array([244, 247, 246], dtype=np.float32)
bg = bg * 0.45 + frost[None, None, :] * 0.55

# 顶部向下渐隐的高光，模拟玻璃受光
sheen = np.clip(1 - yy / (SIZE * 0.9), 0, 1) ** 2 * 18
bg += sheen[..., None]

# 细噪点（磨砂颗粒感）
noise = rng.normal(0, 2.2, (SIZE, SIZE, 1))
bg += noise

img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

# ---------- 贴上标签图标 ----------
icon = Image.open(SRC).convert("RGBA")
inner = int(SIZE * ICON_SCALE)
icon = icon.resize((inner, inner), Image.LANCZOS)
offset = (SIZE - inner) // 2
img.paste(icon, (offset, offset), icon)

# ---------- 圆角（macOS 风格 squircle，约 22.5% 半径，4x 超采样抗锯齿） ----------
SS = 4
mask = Image.new("L", (SIZE * SS, SIZE * SS), 0)
ImageDraw.Draw(mask).rounded_rectangle(
    [0, 0, SIZE * SS - 1, SIZE * SS - 1], radius=int(SIZE * 0.225 * SS), fill=255
)
mask = mask.resize((SIZE, SIZE), Image.LANCZOS)
img.putalpha(mask)

img.save(OUT)
print("saved:", OUT)
