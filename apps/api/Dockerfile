# Build context: raíz del monorepo (ver docker-compose.yml).
FROM node:22-bookworm-slim AS base
RUN npm install --global pnpm@11.3.0
WORKDIR /repo

FROM base AS build
# Primero solo los manifiestos, para cachear la instalación de dependencias.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/sources/package.json packages/sources/
RUN pnpm install --frozen-lockfile --filter @job-finder/api...

COPY packages/shared packages/shared
COPY packages/sources packages/sources
COPY apps/api apps/api
RUN pnpm --filter @job-finder/api... build \
  && pnpm --filter @job-finder/api deploy --legacy --prod /out

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
# CLI de Claude para el proveedor claude-cli (ADR 0006). Versión fija: se actualiza a propósito.
# Se autentica con CLAUDE_CODE_OAUTH_TOKEN (generado con `claude setup-token`) desde .env.
ARG CLAUDE_CODE_VERSION=2.1.296
ENV DISABLE_AUTOUPDATER=1
RUN npm install --global @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} && npm cache clean --force

# Chromium sin ventana para leer los portales con la sesión del usuario (ADR 0012). Va en una capa
# propia, antes del código, para no descargarlo en cada build. La versión debe ser la misma de la
# dependencia `playwright`: cada versión de Playwright usa una revisión exacta del navegador.
ARG PLAYWRIGHT_VERSION=1.64.0
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx --yes playwright@${PLAYWRIGHT_VERSION} install --with-deps --only-shell chromium \
  && npm cache clean --force && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build --chown=node:node /out .
# Falla el build si la dependencia y el navegador instalado quedaron en versiones distintas.
RUN INSTALLED=$(node -p "require('./node_modules/playwright/package.json').version") \
  && if [ "$INSTALLED" != "$PLAYWRIGHT_VERSION" ]; then \
       echo "playwright $INSTALLED no coincide con PLAYWRIGHT_VERSION=$PLAYWRIGHT_VERSION del Dockerfile" >&2; exit 1; \
     fi
RUN mkdir data && chown node:node data
USER node
EXPOSE 3000 4100
CMD ["node", "dist/main.js"]
