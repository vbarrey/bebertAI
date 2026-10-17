FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV DATABASE_URL=file:/app/data/database/bebertai.db

RUN npx prisma generate

# An empty database for the pages prerendered by the build; at run time the data volume hides it and start-docker.sh migrates the real one.
RUN mkdir -p /app/data/database && npx prisma migrate deploy

RUN npm run build && npm prune --omit=dev

FROM node:22-alpine

WORKDIR /app

# OCR: Tesseract (fra, eng, deu, rus data) and Poppler's pdftoppm to render PDF pages as images.
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-fra tesseract-ocr-data-eng tesseract-ocr-data-deu tesseract-ocr-data-rus poppler-utils

ENV DATABASE_URL=file:/app/data/database/bebertai.db

# The worker runs the sources with tsx: the whole project is kept, without the dev dependencies and the npm cache.
COPY --from=build /app /app

EXPOSE 3000

CMD ["sh", "./docker/start-docker.sh"]
