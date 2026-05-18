# Build phase
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/tsconfig.json apps/admin/vite.config.ts apps/admin/index.html ./apps/admin/
RUN npm install --workspace @tagrende-quote/admin --include-workspace-root
COPY apps/admin/src ./apps/admin/src
RUN npm run build -w @tagrende-quote/admin

# Serve phase (Nginx)
FROM nginx:alpine
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
