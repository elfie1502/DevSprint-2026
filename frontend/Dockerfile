FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .

ARG PUBLIC_GATEWAY_URL=http://localhost:3001
ARG PUBLIC_IDENTITY_URL=http://localhost:3005
ARG PUBLIC_NOTIFICATION_URL=http://localhost:3004
ENV PUBLIC_GATEWAY_URL=$PUBLIC_GATEWAY_URL
ENV PUBLIC_IDENTITY_URL=$PUBLIC_IDENTITY_URL
ENV PUBLIC_NOTIFICATION_URL=$PUBLIC_NOTIFICATION_URL

RUN pnpm run build

FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/build ./build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "build"]
