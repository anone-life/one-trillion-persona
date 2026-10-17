"""用 lunar_python 生成排盘参照（验收第 2、3 条用）。

时区固定为北京时间（UTC+8，lunar_python 的约定），子时换日按 23:00（lunar_python 的 sect=1，和 rules v1 一致）。
输出 packages/core/test/fixtures/oracle-pillars.json：
  { "tz": "+08:00", "cases": [[y, m, d, h, mi, "年柱 月柱 日柱 时柱"], ...] }
前 20 条是挑过的边界时刻（立春前后、23 点前后、1900 年初、2100 年末），后面 10,000 条随机：
其中 2,000 条落在「节」前后 10 分钟内、1,000 条落在 22:50–23:10，其余在 1900–2100 均匀分布。

用法：python -I tools/gen_oracle_pillars.py <仓库根目录>
"""
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from lunar_python import Solar

BEIJING = timezone(timedelta(hours=8))


def pillars(dt: datetime) -> str:
    ec = Solar.fromYmdHms(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second).getLunar().getEightChar()
    ec.setSect(1)
    return " ".join([ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()])


def row(dt: datetime) -> list:
    return [dt.year, dt.month, dt.day, dt.hour, dt.minute, pillars(dt)]


def main(root: Path) -> None:
    rng = random.Random(20261017)
    terms = json.loads((root / "spec" / "data" / "solar-terms.v1.json").read_text())["terms"]
    fixed = [
        datetime(1900, 1, 1, 0, 0), datetime(1900, 1, 1, 23, 30), datetime(2100, 12, 31, 22, 59),
        datetime(2100, 12, 31, 23, 0), datetime(1984, 2, 4, 23, 0), datetime(1984, 2, 5, 0, 0),
        datetime(2000, 1, 1, 12, 0), datetime(2000, 2, 4, 20, 40), datetime(2000, 2, 4, 20, 41),
        datetime(1998, 4, 12, 7, 30), datetime(1976, 7, 28, 3, 42), datetime(1949, 10, 1, 15, 0),
        datetime(2024, 2, 4, 16, 26), datetime(2024, 2, 4, 16, 28), datetime(1999, 12, 31, 23, 59),
        datetime(2012, 12, 21, 0, 59), datetime(1969, 7, 21, 10, 56), datetime(2001, 9, 11, 21, 46),
        datetime(1912, 1, 1, 0, 0), datetime(2050, 1, 20, 23, 15),
    ]
    cases = [row(d) for d in fixed]

    start = datetime(1900, 1, 1, tzinfo=BEIJING).timestamp()
    end = datetime(2100, 12, 31, 22, 0, tzinfo=BEIJING).timestamp()
    jie = [t for y in range(1900, 2101) for i, t in enumerate(terms[str(y)]) if i % 2 == 0]
    for _ in range(2000):  # 「节」前后 10 分钟
        t = rng.choice(jie) + rng.randint(-600, 600)
        if start <= t <= end:
            cases.append(row(datetime.fromtimestamp(t, BEIJING).replace(second=0, tzinfo=None)))
    for _ in range(1000):  # 22:50–23:10
        day = datetime.fromtimestamp(rng.uniform(start, end), BEIJING).replace(tzinfo=None)
        dt = day.replace(hour=22, minute=50, second=0) + timedelta(minutes=rng.randint(0, 20))
        if dt.year <= 2100:
            cases.append(row(dt))
    while len(cases) < 10020:
        dt = datetime.fromtimestamp(rng.uniform(start, end), BEIJING).replace(second=0, tzinfo=None)
        cases.append(row(dt))

    out = {"tz": "+08:00", "rules": "day changes at 23:00 (lunar_python sect=1)", "source": "lunar_python 1.4.8", "cases": cases}
    path = root / "packages" / "core" / "test" / "fixtures" / "oracle-pillars.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"wrote {len(cases)} cases to {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
