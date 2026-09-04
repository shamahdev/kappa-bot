FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src ./src
COPY drizzle ./drizzle
COPY drizzle.config.ts tsconfig.json ./
ENV NODE_ENV=production BOT_ROLE=gateway PORT=3000
EXPOSE 3000
CMD ["bun", "src/index.ts"]
