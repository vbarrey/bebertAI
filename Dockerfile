FROM node:22-alpine

WORKDIR /app

# OCR: Tesseract (fra, eng, deu, rus data) and Poppler's pdftoppm to render PDF pages as images.
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-fra tesseract-ocr-data-eng tesseract-ocr-data-deu tesseract-ocr-data-rus poppler-utils

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