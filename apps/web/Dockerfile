# Web ve yönetim konsolu: Next.js "standalone" çıktısı. APP=web veya APP=admin.
ARG APP=web
FROM node:22-slim AS build
ARG APP
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@rengarenk/${APP}...

FROM node:22-slim AS runtime
ARG APP
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
USER node
EXPOSE 3000
ENV APP=${APP}
CMD ["sh", "-c", "node apps/$APP/server.js"]
