# ---------- deps ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN corepack enable

# deps necesarias para better-sqlite3 (compila nativo) y para python libs
RUN apt-get update && apt-get install -y \
  python3 python3-pip python3-venv \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- build ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable

RUN apt-get update && apt-get install -y \
  python3 python3-pip python3-venv \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -U pip
RUN pip install --no-cache-dir pymupdf


# prisma
RUN pnpm prisma generate

# build next
RUN pnpm build

# ---------- runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

RUN apt-get update && apt-get install -y \
  python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -U pip
RUN pip install --no-cache-dir pymupdf

COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "start"]
