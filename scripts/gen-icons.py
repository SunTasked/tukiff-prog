"""Génère les icônes d'application à partir de docs/brand/tkf-logo.jpg.

Deux variantes : blanc (prod) et rouge (previews / staging), sur fond sombre.
Usage : python3 scripts/gen-icons.py   (nécessite Pillow)
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
BG = (9, 9, 11)  # zinc-950, couleur de fond de l'app
VARIANTS = {'prod': (255, 255, 255), 'staging': (239, 68, 68)}  # blanc / red-500
# Logo « TKF » seul (sans « PROGRAMMING », illisible en petit) : fichier -> (taille, largeur du logo).
# La version maskable reste dans la zone de sécurité Android (cercle de 80 %).
ICONS = {
    'pwa-192.png': (192, 0.78),
    'pwa-512.png': (512, 0.78),
    'pwa-maskable-512.png': (512, 0.62),
    'apple-touch-icon.png': (180, 0.78),
    'favicon-32.png': (32, 0.94),
}

src = ImageOps.grayscale(Image.open(ROOT / 'docs/brand/tkf-logo.jpg'))
# Masque = luminance (logo blanc sur noir), recadré sur les lettres TKF.
mask = src.crop((0, 0, src.width, 220)).point(lambda v: 0 if v < 40 else min(255, int((v - 40) * 255 / 175)))
mask = mask.crop(mask.getbbox())

for env, color in VARIANTS.items():
    out = ROOT / 'public/icons' / env
    out.mkdir(parents=True, exist_ok=True)
    for name, (size, width) in ICONS.items():
        scale = 4  # rendu en grand puis réduction pour un anti-crénelage propre
        big = size * scale
        w = int(big * width)
        h = round(mask.height * w / mask.width)
        m = mask.resize((w, h), Image.LANCZOS)
        icon = Image.new('RGB', (big, big), BG)
        icon.paste(Image.new('RGB', (w, h), color), ((big - w) // 2, (big - h) // 2), m)
        icon.resize((size, size), Image.LANCZOS).save(out / name, optimize=True)
