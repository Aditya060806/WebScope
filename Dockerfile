# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package*.json ./
# Skip lifecycle scripts here; Playwright browsers are provided by runtime base image.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM mcr.microsoft.com/playwright:v1.50.0-jammy AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    WEBSCOPE_PORT=3000 \
    WEBSCOPE_COLS=100 \
    WEBSCOPE_TIMEOUT=30000

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY mcp ./mcp
COPY tools ./tools
COPY public ./public
COPY openapi.yaml ./openapi.yaml
COPY README.md ./README.md
COPY LICENSE ./LICENSE
COPY logo.svg ./logo.svg

# Ensure browser revision matches the installed playwright package (lockfile-driven).
RUN npx --yes playwright install chromium

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const port=process.env.WEBSCOPE_PORT||3000;const http=require('http');const req=http.get('http://127.0.0.1:'+port+'/health',res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));"

USER pwuser
CMD ["node", "src/cli.js", "--serve"]
