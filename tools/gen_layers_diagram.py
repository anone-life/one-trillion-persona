"""Generate docs/assets/layers-{light,dark}.svg — the eight-layer diagram used in README and docs/DESIGN.md.

    python3 -I tools/gen_layers_diagram.py <repo root>

Colours follow the anone.life "paper and ink" palette. Counts must match spec/ (checked by the core tests).
"""
import math
import sys
from pathlib import Path

W, H = 1200, 960
CX, CY = 600, 470

PALETTES = {
    "light": dict(bg="#f4efe6", card="#fffdf8", ink="#1b1a17", ink2="#514d45", ink3="#8d877a", rule="#d9d1c3", core="#ece5d8", accent="#b8442f", gold="#9c8449"),
    "dark": dict(bg="#131210", card="#1c1a17", ink="#f2eee5", ink2="#bdb7aa", ink3="#857f73", rule="#3a3631", core="#24211d", accent="#e0674c", gold="#c3a664"),
}

OUTER = [
    ("World", "3,072", "era · city · social rules · economy", "culture & era (McAdams & Pals)"),
    ("Body", "768", "form · looks (18+) · presentation · voice", "embodiment"),
    ("Skills", "768", "main skill · second skill · is it real?", "competence & social role"),
    ("Standing", "400", "class · fame · legal record · household", "social position"),
    ("Signs", "576", "style · way of talking · usual place", "self-presentation (Goffman)"),
    ("Drama", "192", "story role · secret · story agency", "narrative identity (McAdams)"),
    ("Quirk", "63", "one small habit that makes them real", "idiographic detail (Allport)"),
]

SERIF = "Iowan Old Style, Charter, Palatino, Georgia, serif"
SANS = "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, size, fill, family=SANS, weight="400", anchor="middle", style=""):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {style}>{esc(s)}</text>'


def svg(p: dict) -> str:
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="One-Trillion Persona: one inner life (Bazi) surrounded by seven outer layers">']
    out.append(f'<rect width="{W}" height="{H}" fill="{p["bg"]}"/>')
    out.append(text(48, 56, "ONE-TRILLION PERSONA", 13, p["ink3"], anchor="start", style='letter-spacing="2.5"'))
    out.append(f'<line x1="48" y1="70" x2="80" y2="70" stroke="{p["accent"]}" stroke-width="1.5"/>')
    out.append(text(48, 104, "One inner life, seven outer layers", 30, p["ink"], family=SERIF, anchor="start"))
    out.append(text(48, 132, "The chart shapes who they are inside. It never decides the outside — each outer layer is drawn on its own.", 15, p["ink2"], anchor="start"))

    # 外圈：七个层的卡片，绕椭圆排开
    rx, ry = 410, 255
    cw, ch = 262, 100
    for i, (name, count, what, theory) in enumerate(OUTER):
        a = -math.pi / 2 + i * 2 * math.pi / len(OUTER)
        x = CX + rx * math.cos(a) - cw / 2
        y = CY + 18 + ry * math.sin(a) - ch / 2
        # 连线到核心边缘（虚线：「独立抽取」，不是从核心推出来的）
        lx, ly = CX + 150 * math.cos(a), CY + 18 + 118 * math.sin(a)
        ex, ey = x + cw / 2, y + ch / 2
        out.append(f'<line x1="{lx:.1f}" y1="{ly:.1f}" x2="{ex:.1f}" y2="{ey:.1f}" stroke="{p["rule"]}" stroke-width="1" stroke-dasharray="3 5"/>')
        out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{cw}" height="{ch}" rx="6" fill="{p["card"]}" stroke="{p["rule"]}"/>')
        out.append(text(x + 16, y + 30, name, 19, p["ink"], family=SERIF, weight="600", anchor="start"))
        out.append(text(x + cw - 16, y + 30, count, 14, p["ink3"], family="ui-monospace, SFMono-Regular, Menlo, monospace", anchor="end"))
        out.append(text(x + 16, y + 56, what, 12.5, p["ink2"], anchor="start"))
        out.append(text(x + 16, y + 80, theory, 12, p["gold"], anchor="start", style='font-style="italic"'))

    # 核心：内在（八字）
    cy = CY + 18
    out.append(f'<ellipse cx="{CX}" cy="{cy}" rx="150" ry="118" fill="{p["core"]}" stroke="{p["accent"]}" stroke-width="1.5"/>')
    out.append(text(CX, cy - 70, "Inner life", 22, p["ink"], family=SERIF, weight="600"))
    out.append(text(CX, cy - 48, "Bazi · 518,400 charts", 13, p["ink3"], family="ui-monospace, SFMono-Regular, Menlo, monospace"))
    out.append(text(CX, cy - 20, "wants · the price · breaks when", 13.5, p["ink"]))
    out.append(text(CX, cy - 2, "one motive, two sides", 12, p["gold"], style='font-style="italic"'))
    out.append(f'<line x1="{CX - 110}" y1="{cy + 12}" x2="{CX + 110}" y2="{cy + 12}" stroke="{p["rule"]}"/>')
    out.append(text(CX, cy + 34, "four faces", 13.5, p["ink"]))
    out.append(text(CX, cy + 52, "strangers · work · up close · deep down", 12, p["ink2"]))
    out.append(text(CX, cy + 72, "if–then signatures (Mischel & Shoda)", 12, p["gold"], style='font-style="italic"'))

    # 底部：数量级。名字「一万亿」只是个大数；真正要记住的是 10^24（2026-10-17 用户定）
    by = H - 104
    out.append(f'<line x1="48" y1="{by - 30}" x2="{W - 48}" y2="{by - 30}" stroke="{p["rule"]}"/>')
    sup = 'baseline-shift="super" font-size="70%"'
    out.append(f'<text x="48" y="{by}" font-family="{SERIF}" font-size="20" fill="{p["ink"]}">Seven outer layers: about 4 × 10<tspan {sup}>18</tspan> people, roughly the grains of sand on Earth.</text>')
    out.append(f'<text x="48" y="{by + 32}" font-family="{SERIF}" font-size="20" fill="{p["ink"]}">Add the inner life (× 518,400): about 2 × 10<tspan {sup}>24</tspan>, roughly the stars in the observable universe.</text>')
    out.append(text(48, by + 60, "The name comes from the core three alone: Bazi × World × Body ≈ 1.07 trillion valid. Counts are combinations, not proven-different people.", 13, p["ink2"], anchor="start"))
    out.append(text(48, by + 82, "Bazi is used as a grammar for fiction, not fortune-telling. Dashed lines: outer layers are drawn independently, never derived from the chart.", 12.5, p["ink3"], anchor="start"))
    out.append("</svg>")
    return "\n".join(out) + "\n"


def main(root: Path) -> None:
    for name, p in PALETTES.items():
        path = root / "docs" / "assets" / f"layers-{name}.svg"
        path.write_text(svg(p))
        print(f"wrote {path}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
