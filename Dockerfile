# ---------- deps ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN corepack enable

# deps necesarias para better-sqlite3 (compila nativo) y para python libs
RUN apt-get update && apt-get install -y \
  python3 python3-pip \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable

RUN apt-get update && apt-get install -y \
  python3 python3-pip \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# instala libs python para el extractor
RUN pip3 install --no-cache-dir pymupdf

# prisma
RUN pnpm prisma generate

# build next
RUN pnpm build

# ---------- runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y \
  python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

# python lib
RUN pip3 install --no-cache-dir pymupdf

COPY --from=build /app ./

EXPOSE 3000
CMD ["pnpm", "start"]
