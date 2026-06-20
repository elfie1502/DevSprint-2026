FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN rm -f pnpm-lock.yaml && pnpm install --no-lockfile --prod --config.ignore-scripts=false
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
