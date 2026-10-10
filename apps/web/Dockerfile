# Build context: raíz del monorepo (ver docker-compose.yml).
FROM node:22-bookworm-slim AS build
RUN npm install --global pnpm@11.3.0
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/sources/package.json packages/sources/
RUN pnpm install --frozen-lockfile --filter @job-finder/web...

COPY packages/shared packages/shared
COPY apps/web apps/web
RUN pnpm --filter @job-finder/web... build

FROM nginx:1.31-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
