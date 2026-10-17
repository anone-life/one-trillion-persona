# tools/

开发时用的 Python 脚本：生成节气表、给排盘器当参照。不进产品依赖。

```bash
python3 -m venv /tmp/venv1t
/tmp/venv1t/bin/pip install --upgrade pip
/tmp/venv1t/bin/pip install lunar_python==1.4.8
# sxtwl 没有 macOS arm64 的现成包，要本地编译；Command Line Tools 找不到 C++ 头文件时，指定 SDK：
S=/Library/Developer/CommandLineTools/SDKs/MacOSX14.sdk
SDKROOT=$S CFLAGS="-isysroot $S -I$S/usr/include/c++/v1" CXXFLAGS="-isysroot $S -I$S/usr/include/c++/v1" \
  /tmp/venv1t/bin/pip install --no-cache-dir sxtwl==2.0.7

/tmp/venv1t/bin/python -I tools/gen_solar_terms.py "$PWD"     # → spec/data/solar-terms.v1.json
/tmp/venv1t/bin/python -I tools/gen_oracle_pillars.py "$PWD"  # → packages/core/test/fixtures/oracle-pillars.json
```

改了这两个输出，就是改了规则数据：要升 `rulesVersion`，并在 `spec/bazi-rules.v1.md` 里写清楚。
