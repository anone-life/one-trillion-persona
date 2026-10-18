# 「奇人」桌宠立绘：把出图清单里每人选中的那张插画抠成透明底，写进 runs/rare-img/<id>.cut.webp。
#   python3 tools/rare_cutout.py --manifest <rare_manifest.json> [--force] [--only 01,05]
# 要装 rembg 和 Pillow、scipy（pip install "rembg[cpu]" pillow scipy）；第一次跑会下两个分割模型。
#
# 做法：isnet-anime 出人物轮廓，u2net_human_seg 外扩 8px 当闸门（单用 isnet-anime 会把桌子、椅背连着人一起留下），
# 再去掉零碎的小块。插画多是坐在桌前的半身，抠出来下沿是一条被桌子切平的直线——
# 所以下面 22% 一律渐隐成透明，像从桌面冒出来的半身像（站着的也多被画框切在腿上）。抠得太少的不出图，桌宠放照片立牌。
# runs/ 不进 git：抠图和照片、预生成的人设一样只在本机。另写一份 runs/rare-img/cutout.json 记每张怎么处理的。
import argparse, json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

p = argparse.ArgumentParser()
p.add_argument("--manifest", required=True)
p.add_argument("--force", action="store_true")
p.add_argument("--only", default="")
a = p.parse_args()

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "runs", "rare-img")
os.makedirs(OUT, exist_ok=True)
people = json.load(open(a.manifest, encoding="utf8"))["people"]
only = {x.strip() for x in a.only.split(",") if x.strip()}
report_path = os.path.join(OUT, "cutout.json")
report = json.load(open(report_path)) if os.path.exists(report_path) else {}

anime = human = None
FADE = 0.22  # 下沿渐隐多高（占人物高度）


def flat_bottom(alpha: np.ndarray) -> float:
    """人物下沿有多大比例落在同一条水平线上（0–1）。被桌子切平的半身 > 0.4，站着的人（两只脚、裙摆）低得多。"""
    ys, xs = np.nonzero(alpha > 128)
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    width = right - left + 1
    lowest = np.full(width, -1)
    for x in range(left, right + 1):
        col = np.nonzero(alpha[:, x] > 128)[0]
        if col.size: lowest[x - left] = col.max()
    band = max(3, int((bottom - top) * 0.02))
    return float(np.mean(lowest >= bottom - band))


made = kept = missing = photo = 0
for person in people:
    pid = person["id"]
    if only and pid not in only: continue
    # 人工验收退回照片的角色不再自动重抠，--force 也不覆盖；旧 cut 留作对照。
    if report.get(pid, {}).get("display") == "photo":
        photo += 1
        print(f"{pid}: photo card (manual review) — skipped")
        continue
    src = (person.get("codex_image_selection") or {}).get("image")
    if not src or not os.path.exists(src):
        missing += 1
        continue
    dst = os.path.join(OUT, f"{pid}.cut.webp")
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src) and not a.force:
        kept += 1
        continue
    if anime is None:
        from rembg import new_session, remove  # 全部跳过时不用加载分割模型
        anime, human = new_session("isnet-anime"), new_session("u2net_human_seg")
    im = Image.open(src).convert("RGB")
    im.thumbnail((1000, 1400))
    m_anime = remove(im, session=anime, only_mask=True)
    m_human = remove(im, session=human, only_mask=True).filter(ImageFilter.MaxFilter(17))
    # 人体分割只当闸门（开或关），不和轮廓相乘——相乘会把深色衣服压成半透明
    alpha = np.where(np.asarray(m_human) > 64, np.asarray(m_anime), 0).astype(np.uint8)
    alpha[alpha < 40] = 0
    # 只留最大的一块，和贴着它、够大的块（扬起的手、拿着的东西）；桌角、烛火这类零碎去掉
    labels, n = ndimage.label(alpha > 0)
    if n == 0:
        print(f"{pid}: nothing left after cutout", file=sys.stderr)
        report[pid] = {"ok": False, "why": "empty"}
        continue
    sizes = ndimage.sum(np.ones_like(alpha), labels, range(1, n + 1))
    keep = {i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.04}
    alpha[~np.isin(labels, list(keep))] = 0
    # 抠得太少（深色衣服融进夜景、不是人形）就不用，桌宠退回照片立牌
    solid = float(np.mean(alpha > 200))
    if solid < 0.05:
        print(f"{pid}: too little left ({solid:.2%} solid) — will show the photo card instead")
        report[pid] = {"ok": False, "why": "too little left", "solid": round(solid, 3)}
        if os.path.exists(dst): os.remove(dst)
        continue
    flat = flat_bottom(alpha)
    faded = True  # 一律渐隐：坐着的下沿被桌子切平，站着的多被画框切在腿上；统一成「从桌面冒出来的半身」
    if faded:
        ys = np.nonzero(alpha.max(axis=1))[0]
        top, bottom = ys.min(), ys.max()
        start = bottom - int((bottom - top) * FADE)
        ramp = np.ones(alpha.shape[0], dtype=np.float32)
        ramp[start:bottom + 1] = np.linspace(1, 0, bottom + 1 - start) ** 1.4
        alpha = (alpha * ramp[:, None]).astype(np.uint8)
    rgba = im.copy()
    rgba.putalpha(Image.fromarray(alpha))
    rgba = rgba.crop(rgba.getbbox())
    rgba.thumbnail((700, 1100))
    rgba.save(dst, "WEBP", quality=84, method=5)
    report[pid] = {"ok": True, "flatBottom": round(flat, 2), "faded": faded, "solid": round(solid, 3), "size": list(rgba.size), "source": os.path.basename(src)}
    made += 1
    print(f"{pid}: {'faded' if faded else 'standing'} (flat {flat:.2f}) {rgba.size[0]}x{rgba.size[1]}")

json.dump(report, open(report_path, "w"), indent=1, ensure_ascii=False)
print(f"made {made}, unchanged {kept}, photo card {photo}, no image {missing} (of {len(people)})")
