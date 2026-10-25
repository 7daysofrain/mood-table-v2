# Imagen del PR Babysitter (change pr-tracking, decisión 10). Se construye desde la raíz del monorepo
# (compose.yaml), y `pnpm deploy` deja solo este paquete con sus dependencias de producción.

FROM node:24-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @moodtable/pr-babysitter
RUN pnpm deploy --filter @moodtable/pr-babysitter --prod /app

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app .
USER node
CMD ["node", "src/main.ts"]
