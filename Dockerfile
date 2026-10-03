# The Angular dashboard behind nginx, which also proxies /api to SIRIAUTOPOST.Api
# (service "api" in siri_autopost_backend/docker-compose.saas.yml).
#   docker build -t siriautopost-web .
FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist/siri-autopost-ui/browser /usr/share/nginx/html
EXPOSE 80
