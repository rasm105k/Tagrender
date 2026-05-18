# Build phase
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --workspace @tagrende-quote/widget --include-workspace-root
COPY apps/widget/package.json apps/widget/tsconfig.json apps/widget/vite.config.ts apps/widget/index.html ./apps/widget/
RUN npm install --workspace @tagrende-quote/widget --include-workspace-root
COPY apps/widget/src ./apps/widget/src
RUN npm run build -w @tagrende-quote/widget

# Serve phase (Nginx)
FROM nginx:alpine
COPY --from=builder /app/apps/widget/dist /usr/share/nginx/html
COPY apps/widget/index.html /usr/share/nginx/html/index.html
COPY apps/widget/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
