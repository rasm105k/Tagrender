# Build phase
FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY apps/gateway/package.json apps/gateway/tsconfig.json ./apps/gateway/
RUN npm install --workspace @tagrende-quote/gateway --include-workspace-root
COPY apps/gateway/src ./apps/gateway/src
RUN npm run build -w @tagrende-quote/gateway

ENV NODE_ENV=production

EXPOSE 8082
CMD ["node", "apps/gateway/dist/index.js"]
