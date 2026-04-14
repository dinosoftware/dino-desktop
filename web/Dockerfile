FROM node:20-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
# Create default settings.js from example (override with volume mount)
RUN cp /usr/share/nginx/html/settings.js.example /usr/share/nginx/html/settings.js
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
