FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN bunx prisma generate

RUN bun run build

EXPOSE 3000

CMD ["sh", "./docker/start-docker.sh"]