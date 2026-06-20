FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install 
COPY . .
RUN pnpm run build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install  --prod
COPY --from=builder /app/build ./build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "build"]
