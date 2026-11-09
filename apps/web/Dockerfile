# Web ve yönetim konsolu: Next.js "standalone" çıktısı. APP=web veya APP=admin.
ARG APP=web
FROM node:22-slim AS build
ARG APP
# Tarayıcıya giden kodda API adresi derleme anında gömülür (Next.js NEXT_PUBLIC_*).
ARG NEXT_PUBLIC_API_URL=https://api.rengarenk.com.tr
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} NEXT_TELEMETRY_DISABLED=1
# Reklam ölçümü (Karar 35): boşsa Pixel ve Google etiketi hiç yüklenmez; doluysa yalnızca çerez izniyle
ARG NEXT_PUBLIC_META_PIXEL_ID=
ARG NEXT_PUBLIC_GOOGLE_TAG_ID=
ENV NEXT_PUBLIC_META_PIXEL_ID=${NEXT_PUBLIC_META_PIXEL_ID} NEXT_PUBLIC_GOOGLE_TAG_ID=${NEXT_PUBLIC_GOOGLE_TAG_ID}
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@rengarenk/${APP}...

FROM node:22-slim AS runtime
ARG APP
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/${APP}/.next/static ./apps/${APP}/.next/static
USER node
EXPOSE 3000
ENV APP=${APP}
CMD ["sh", "-c", "node apps/$APP/server.js"]
