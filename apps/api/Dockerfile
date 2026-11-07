# API ve işçi aynı imajdan çalışır: `node dist/main.js` veya `node dist/worker.js`.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@rengarenk/api...
RUN pnpm --filter @rengarenk/api deploy --prod --legacy /out

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]

# Veritabanı göçleri için tek seferlik imaj: `docker compose run --rm migrate`
FROM build AS migrate
WORKDIR /repo/packages/db
CMD ["pnpm", "prisma", "migrate", "deploy"]
