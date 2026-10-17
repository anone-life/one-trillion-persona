"""生成 1900–2100 的二十四节气时刻表（UTC 秒），并用第二个库逐条对照。

主源 sxtwl（寿星天文历），对照 lunar_python（6tail）。两库给的都是北京时间（UTC+8），
这里统一换成 UTC 存。输出 spec/data/solar-terms.v1.json：
  { "rulesVersion": 1, "source": ..., "firstYear": 1899, "terms": { "<year>": [24 个 UTC 秒] } }
每年的 24 个按「小寒、大寒、立春、雨水 … 冬至」排（index 0 = 小寒，2 = 立春），都落在该公历年内。
多生成 1899 和 2101 两年，排 1900-01-01 和 2100-12-31 附近的盘时用得到。

用法：python -I tools/gen_solar_terms.py <仓库根目录>
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import sxtwl
from lunar_python import Solar

NAMES = ["小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至",
         "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"]
# lunar_python 表里的键：在当年范围内的就是中文名（年初的冬至、大雪用拼音键区分上一年的）
BEIJING = timezone(timedelta(hours=8))


def sxtwl_terms(year: int) -> list[int]:
    """sxtwl 的 jqIndex：0=冬至、1=小寒、2=大寒、3=立春…… 取落在 year 年内的 24 个。"""
    out = {}
    for y in (year - 1, year, year + 1):
        for x in sxtwl.getJieQiByYear(y):
            d = sxtwl.JD2DD(x.jd)
            sec = int(d.s)
            frac = d.s - sec
            dt = datetime(d.Y, d.M, d.D, int(d.h), int(d.m), sec, tzinfo=BEIJING) + timedelta(seconds=frac)
            if dt.year != year:
                continue
            name = NAMES[(x.jqIndex - 1) % 24]
            out[name] = round(dt.timestamp())
    assert len(out) == 24, (year, len(out))
    return [out[n] for n in NAMES]


PINYIN = {"DONG_ZHI": "冬至", "XIAO_HAN": "小寒", "DA_HAN": "大寒", "LI_CHUN": "立春",
          "YU_SHUI": "雨水", "JING_ZHE": "惊蛰", "DA_XUE": "大雪"}


def lunar_terms(year: int) -> list[int]:
    """lunar_python 的表按农历年给，跨两个公历年；拼音键是相邻年份的同名节气。合并两张表再按公历年筛。"""
    found = {}
    for anchor in (year, year + 1):
        table = Solar.fromYmd(anchor, 6, 1).getLunar().getJieQiTable()
        for key, s in table.items():
            name = PINYIN.get(key, key)
            dt = datetime(s.getYear(), s.getMonth(), s.getDay(), s.getHour(), s.getMinute(), s.getSecond(), tzinfo=BEIJING)
            if dt.year == year:
                found[name] = round(dt.timestamp())
    return [found[n] for n in NAMES]


def main(root: Path) -> None:
    terms = {}
    worst = (0, None)
    over = []
    for y in range(1899, 2102):
        a = sxtwl_terms(y)
        b = lunar_terms(y)
        for i, (x, z) in enumerate(zip(a, b)):
            diff = abs(x - z)
            if diff > worst[0]:
                worst = (diff, (y, NAMES[i]))
            if diff > 120:
                over.append((y, NAMES[i], diff))
        terms[str(y)] = a
    out = {
        "rulesVersion": 1,
        "source": "sxtwl 2.0.7 (primary), cross-checked with lunar_python 1.4.8",
        "unit": "UTC epoch seconds",
        "order": NAMES,
        "firstYear": 1899,
        "lastYear": 2101,
        "terms": terms,
    }
    path = root / "spec" / "data" / "solar-terms.v1.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {path} ({path.stat().st_size} bytes)")
    print(f"max diff between libraries: {worst[0]} s at {worst[1]}")
    print(f"terms differing by > 120 s: {len(over)}")
    for row in over[:20]:
        print("  ", row)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
