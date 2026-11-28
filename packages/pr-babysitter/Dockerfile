# Imágenes del PR Babysitter (change pr-tracking, decisión 10) y de su fixer (change pr-fixer,
# decisión 4). Se construyen desde la raíz del monorepo (compose.yaml), y `pnpm deploy` deja solo este
# paquete con sus dependencias de producción, entre ellas el binario del Claude Agent SDK de la
# plataforma de la imagen.

FROM node:24-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @moodtable/pr-babysitter
RUN pnpm deploy --filter @moodtable/pr-babysitter --prod /app

# El fixer clona el repo, instala sus dependencias y pasa lint, typecheck y test: necesita git y pnpm.
# Sin NODE_ENV=production, para que `pnpm install` en el clon instale también las de desarrollo.
FROM node:24-slim AS fixer
RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# El volumen de la cola (compose.yaml) hereda el dueño de la carpeta.
RUN mkdir /data && chown node:node /data
WORKDIR /app
COPY --from=build --chown=node:node /app .
USER node
CMD ["node", "src/fixer/main.ts"]

FROM node:24-slim AS babysitter
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app .
USER node
CMD ["node", "src/main.ts"]
