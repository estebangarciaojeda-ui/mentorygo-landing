"""Genera la landing autocontenida de MentoryGo.

Uso:  python build.py
Salida:
  dist/index.html     documento completo para abrir localmente o publicar en GitHub Pages
  dist/artifact.html  fragmento para publicar como Artifact de Claude
Requiere Python 3.8+ y Pillow (pip install pillow) solo para recortar el icono.
"""
import base64
import io
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src" / "page.html"
DATA = ROOT / "data" / "demo-data.json"
ICON = ROOT / "assets" / "icono-mentorygo.png"
DIST = ROOT / "dist"


def icon_data_uri(size=144):
    try:
        from PIL import Image
    except ImportError:
        return "data:image/png;base64," + base64.b64encode(ICON.read_bytes()).decode()
    im = Image.open(ICON).convert("RGBA").resize((size, size), Image.LANCZOS)
    # fondo blanco a transparente para que el icono funcione en tema oscuro
    px = im.load()
    for y in range(size):
        for x in range(size):
            r, g, b, a = px[x, y]
            m = min(r, g, b)
            if m > 200:
                alpha = max(0, int((255 - m) / 55 * 255))
                px[x, y] = (r, g, b, min(a, alpha))
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    page = SRC.read_text(encoding="utf-8")
    data = json.loads(DATA.read_text(encoding="utf-8"))
    page = page.replace("{{ICON}}", icon_data_uri()).replace("{{DATA}}", json.dumps(data, ensure_ascii=False))
    DIST.mkdir(exist_ok=True)
    (DIST / "artifact.html").write_text(page, encoding="utf-8")
    head_end = page.index("<style>")
    full = (
        "<!doctype html>\n<html lang=\"es-EC\">\n<head>\n<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
        + page[:head_end]
        + "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n"
        + page[head_end:].replace("</style>", "</style>\n</head>\n<body>", 1)
        + "\n</body>\n</html>\n"
    )
    (DIST / "index.html").write_text(full, encoding="utf-8")
    (DIST / ".nojekyll").write_text("", encoding="utf-8")
    print("OK:", DIST / "index.html", len(full) // 1024, "KB")


if __name__ == "__main__":
    main()
