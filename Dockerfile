FROM node:alpine AS builder
WORKDIR /app
COPY . /app
RUN npm install && npm run build

FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
RUN chmod -R a+rX /usr/share/nginx/html
COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf
COPY deployment/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
