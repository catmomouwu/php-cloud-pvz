# syntax=docker/dockerfile:1
# 构建 Node 版本（Nitro node-server preset）。游戏资源 *.pak 由 .dockerignore 排除，绝不进入镜像。
# 运行需要的环境变量见 .env.example；数据库默认在 /app/.data（建议挂载 volume）。
# main.pak 运行时挂载到 /app/game/main.pak（只读），由服务端提供给已登录用户。

FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    NITRO_DATABASE_PATH=/app/.data/cloud-pvz.sqlite \
    NITRO_GAME_PAK_PATH=/app/game/main.pak \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning
COPY --from=build /app/.output ./.output
VOLUME /app/.data
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
