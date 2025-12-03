# Stage 1: Prune
FROM node:18-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm@9
COPY . .
RUN pnpm dlx turbo prune --scope=@resume-optimizer/backend --docker

# Stage 2: Build
FROM node:18-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
RUN npm install -g pnpm
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json
RUN cd packages/backend && pnpm prisma generate
RUN pnpm run build --filter=@resume-optimizer/backend...

# Stage 3: Runtime
FROM node:18-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/node_modules ./node_modules
COPY --from=builder /app/packages/backend/package.json ./package.json
COPY --from=builder /app/packages/backend/prisma ./prisma
COPY --from=builder /app/packages/backend/.env.example ./.env.example

# Set correct permissions
RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3000

ENV PORT 3000
ENV NODE_ENV production

CMD ["node", "dist/main"]
