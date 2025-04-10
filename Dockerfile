# syntax = docker/dockerfile:1

###############################
# Build Stage
###############################
FROM oven/bun:latest AS builder

# 设置工作目录和生产环境变量
WORKDIR /app
ENV NODE_ENV=production

# 复制依赖配置文件（如果有 bun.lock 则复制，不存在也无影响）
COPY package.json bun.lock* ./

# 安装项目依赖
RUN bun install --production

# 复制项目全部代码
COPY . .

# 使用 bun build 将 TypeScript 代码编译打包至 dist 目录，并做最小化处理
RUN bun build src/index.ts --outdir dist --target bun --minify

###############################
# Production Stage
###############################
FROM oven/bun:latest AS runner

WORKDIR /app
ENV NODE_ENV=production

# 如果项目中有静态资源（例如 Hono 的 swagger ui 配置的资源）需要复制，则可在此处一并复制至最终镜像
# COPY public ./public

# 复制编译好的文件
COPY --from=builder /app/dist ./dist

# 默认开放端口（可根据代码中的设置，Hono 配置默认端口通常为 8080 或其它）
EXPOSE 8080

# 启动生产环境服务（运行编译后的应用）
CMD ["bun", "run", "dist/index.js"]
