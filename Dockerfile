# Sansta ERP — production image for Coolify / Docker
FROM node:20-bookworm-slim

WORKDIR /app

# Prisma needs OpenSSL on Debian slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install root dependencies (includes Prisma for migrate deploy)
COPY package.json package-lock.json ./
RUN npm ci

# Install admin dependencies and build React panel
COPY admin/package.json admin/package-lock.json ./admin/
RUN cd admin && npm ci

COPY backend ./backend
COPY admin ./admin

# Ensure Devanagari fonts exist for PDF receipts (required in production)
RUN mkdir -p backend/fonts \
  && if [ ! -f backend/fonts/NotoSansDevanagari-Regular.ttf ] || [ ! -f backend/fonts/NotoSansDevanagari-Bold.ttf ]; then \
       apt-get update -y \
       && apt-get install -y --no-install-recommends curl \
       && curl -fsSL -o backend/fonts/NotoSansDevanagari-Regular.ttf \
            "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf" \
       && curl -fsSL -o backend/fonts/NotoSansDevanagari-Bold.ttf \
            "https://github.com/googlefonts/noto-fonts/raw/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Bold.ttf" \
       && rm -rf /var/lib/apt/lists/*; \
     fi \
  && test -s backend/fonts/NotoSansDevanagari-Regular.ttf \
  && test -s backend/fonts/NotoSansDevanagari-Bold.ttf

RUN npm run admin:build
RUN npx prisma generate --schema=backend/prisma/schema.prisma

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/v1/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
