FROM node:20-slim

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.js ./

EXPOSE 8080

CMD ["npm", "start"]
