# Hindi fonts for PDF receipts

Download these files into this folder:

- [NotoSansDevanagari-Regular.ttf](https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf)
- [NotoSansDevanagari-Bold.ttf](https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Bold.ttf)

Without these fonts, receipts fall back to Helvetica (Hindi may not render correctly).

```bash
curl -L -o NotoSansDevanagari-Regular.ttf \
  "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf"
curl -L -o NotoSansDevanagari-Bold.ttf \
  "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Bold.ttf"
```
