# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# Aktifkan pnpm via corepack (built-in Node 22, tidak perlu install global)
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files — pnpm-lock.yaml WAJIB ikut untuk --frozen-lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install deps deterministik (gagal kalau lockfile drift)
RUN pnpm install --frozen-lockfile

# Copy sisa source
COPY . .

# Build production bundle
RUN pnpm build

# Stage 2: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=[REDACTED-IP_ADDRESS]

# Hanya bawa output bundle (.output sudah berisi runtime deps)
COPY --from=builder /app/.output ./.output

EXPOSE 8080
CMD ["node", ".output/server/index.mjs"]
