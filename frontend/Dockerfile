# syntax=docker/dockerfile:1

# ---- Build ----------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Vite inlines these at build time, so they are build args rather than runtime env.
ARG VITE_API_BASE_URL=/api
ARG VITE_SITE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SITE_URL=$VITE_SITE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Serve ----------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
