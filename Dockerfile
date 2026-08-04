FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN mkdir -p /app/data

RUN npx prisma generate

RUN npx prisma migrate deploy

RUN chmod +x ./docker/start-docker.sh

RUN npm run build

EXPOSE 3000

CMD ["sh", "./docker/start-docker.sh"]