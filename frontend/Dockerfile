FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
COPY . .
RUN npm run build

# Nginx serves static files only. The browser calls Flask using VITE_API_URL baked at build time
# (see getApiBaseUrl.ts). Do not rely on same-origin /api in this image unless an ALB routes /api.
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.config /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx","-g","daemon off;"]
