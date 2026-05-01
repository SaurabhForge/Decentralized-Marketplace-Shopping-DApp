FROM node:20-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT:-8080}"]
