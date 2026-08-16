FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next.config.ts's rewrites() is invoked by `next build` (not at request
# time) to produce .next/routes-manifest.json, which is what the standalone
# production server actually consults for "/api/*" proxy destinations.
# BACKEND_URL must therefore be correct at BUILD time, not just at
# container runtime — a runtime-only env var has no effect on the already
# baked-in rewrite destination. Defaults to localhost:5000 for plain
# `docker build` outside Compose; docker-compose.yml overrides this via
# build args to the Docker service hostname.
ARG BACKEND_URL=http://localhost:5000
ENV BACKEND_URL=$BACKEND_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
