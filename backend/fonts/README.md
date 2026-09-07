# Hindi fonts for PDF receipts (donation + expense vouchers)

Required files in this folder:

- NotoSansDevanagari-Regular.ttf
- NotoSansDevanagari-Bold.ttf

These fonts **must ship in the Docker image**. Without them, PDFKit falls back to Helvetica and Devanagari becomes garbled (mojibake).

Download (if missing locally):

```bash
cd backend/fonts
curl -L -o NotoSansDevanagari-Regular.ttf \
  "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf"
curl -L -o NotoSansDevanagari-Bold.ttf \
  "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Bold.ttf"
```

The production Dockerfile also downloads these automatically when they are absent at build time.
