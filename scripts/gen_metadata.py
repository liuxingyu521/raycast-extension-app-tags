"""生成 Raycast Store metadata 封面图（2000x1250），风格与扩展图标一致。"""
from PIL import Image, ImageDraw, ImageFont

W, H = 2000, 1250
TOP = (108, 92, 231)   # #6C5CE7
BOT = (41, 128, 235)   # #2980EB
OUT = "/Users/xj/Github/raycast-extension-app-tags/reat/metadata/app-tags-1.png"

HELVETICA = "/System/Library/Fonts/Helvetica.ttc"          # index 1 = Bold
HIRAGINO_GB = "/System/Library/Fonts/Hiragino Sans GB.ttc"  # 简中，index 0 = W3, 1 = W6

def font(path, size, index=0):
    try:
        return ImageFont.truetype(path, size, index=index)
    except Exception:
        return ImageFont.load_default()

f_title = font(HELVETICA, 190, index=1)   # Helvetica Bold
f_sub = font(HIRAGINO_GB, 64, index=1)    # 冬青黑体简 W6
f_chip = font(HIRAGINO_GB, 52, index=1)

# ---------- 背景：对角线渐变 ----------
img = Image.new("RGBA", (W, H))
gd = ImageDraw.Draw(img)
for y in range(H):
    for x in range(0, W, 4):
        t = (x / W + y / H) / 2
        r = int(TOP[0] + (BOT[0] - TOP[0]) * t)
        g = int(TOP[1] + (BOT[1] - TOP[1]) * t)
        b = int(TOP[2] + (BOT[2] - TOP[2]) * t)
        gd.rectangle([x, y, x + 3, y], fill=(r, g, b, 255))

# ---------- 左侧：大号标签图形 ----------
def draw_tag(base, cx, cy, w, h, rot=30):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    pts = [
        (cx - w // 2, cy - h // 2),
        (cx + w // 2 - int(w * 0.2), cy - h // 2),
        (cx + w // 2, cy),
        (cx + w // 2 - int(w * 0.2), cy + h // 2),
        (cx - w // 2, cy + h // 2),
    ]
    ld.polygon(pts, fill=(255, 255, 255, 255))
    hole = Image.new("L", base.size, 0)
    hd = ImageDraw.Draw(hole)
    hr = int(h * 0.13)
    hx = cx - w // 2 + int(w * 0.18)
    hd.ellipse([hx - hr, cy - hr, hx + hr, cy + hr], fill=255)
    layer = Image.composite(Image.new("RGBA", base.size, (0, 0, 0, 0)), layer, hole)
    return layer.rotate(rot, resample=Image.BICUBIC, center=(cx, cy))

img = Image.alpha_composite(img, draw_tag(img, 560, 560, 620, 400))
d = ImageDraw.Draw(img)  # 合成后需重建 Draw 对象

# ---------- 右侧：标题与副标题 ----------
tx = 1060
d.text((tx, 470), "App Tags", font=f_title, fill=(255, 255, 255))
d.text((tx, 730), "为应用打上标签", font=f_sub, fill=(255, 255, 255))
d.text((tx, 820), "用你记得住的方式启动它", font=f_sub, fill=(240, 244, 255))

# ---------- 底部：示例标签 chips（半透明胶囊在独立图层上做 alpha 混合） ----------
chips = ["docker", "设计", "办公"]
overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
cx0, cy0 = tx, 970
chip_boxes = []
for c in chips:
    tw = d.textlength(c, font=f_chip)
    pad_x, pad_y = 36, 20
    bw = int(tw + pad_x * 2)
    bh = 52 + pad_y * 2
    od.rounded_rectangle([cx0, cy0, cx0 + bw, cy0 + bh], radius=bh // 2,
                         fill=(255, 255, 255, 40), outline=(255, 255, 255, 170), width=3)
    chip_boxes.append((c, cx0 + pad_x, cy0 + pad_y - 6))
    cx0 += bw + 32

img = Image.alpha_composite(img, overlay)
d = ImageDraw.Draw(img)
for c, x, y in chip_boxes:
    d.text((x, y), c, font=f_chip, fill=(255, 255, 255))

img.convert("RGB").save(OUT)
print("saved:", OUT)
