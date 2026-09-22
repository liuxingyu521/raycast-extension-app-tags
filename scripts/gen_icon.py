from PIL import Image, ImageDraw

S = 512
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

# rounded rect with vertical gradient (purple -> blue)
grad = Image.new("RGBA", (S, S))
gd = ImageDraw.Draw(grad)
top = (108, 92, 231)   # #6C5CE7
bot = (41, 128, 235)   # #2980EB
for y in range(S):
    t = y / S
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    gd.line([(0, y), (S, y)], fill=(r, g, b, 255))

mask = Image.new("L", (S, S), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([24, 24, S - 24, S - 24], radius=120, fill=255)
img.paste(grad, (0, 0), mask)

# white price-tag glyph on its own layer, then rotate
layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ld = ImageDraw.Draw(layer)
cx, cy = S // 2, S // 2
w, h = 250, 160
pts = [
    (cx - w // 2, cy - h // 2),
    (cx + w // 2 - 50, cy - h // 2),
    (cx + w // 2, cy),
    (cx + w // 2 - 50, cy + h // 2),
    (cx - w // 2, cy + h // 2),
]
ld.polygon(pts, fill=(255, 255, 255, 255))

# punch the string hole out of the tag
hole = Image.new("L", (S, S), 0)
hd = ImageDraw.Draw(hole)
hd.ellipse([cx - w // 2 + 30, cy - 20, cx - w // 2 + 70, cy + 20], fill=255)
layer = Image.composite(Image.new("RGBA", (S, S), (0, 0, 0, 0)), layer, hole)

layer = layer.rotate(35, resample=Image.BICUBIC, center=(cx, cy))
img = Image.alpha_composite(img, layer)

img.save("/Users/xj/Github/raycast-extension-app-tags/reat/assets/icon.png")
print("saved")
