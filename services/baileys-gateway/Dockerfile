FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
ENV PORT=3001 BAILEYS_AUTH_DIR=/data/auth BAILEYS_LEDGER_FILE=/data/sent-events.json
VOLUME ["/data"]
EXPOSE 3001
USER node
CMD ["npm","start"]
