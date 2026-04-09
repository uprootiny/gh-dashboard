FROM node:22-alpine
WORKDIR /app
COPY . .
EXPOSE 10000
ENV PORT=10000
CMD ["node", "api/server.mjs"]
