# Build phase
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json vite.config.ts tsconfig.json index.html ./
RUN npm ci
COPY src ./src
RUN npm run build

# Serve phase (Nginx)
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]