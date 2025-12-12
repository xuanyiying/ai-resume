# Stage 1: Prune
FROM node:18-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm@9
COPY . .
RUN pnpm dlx turbo prune --scope=@resume-optimizer/backend --docker

# Stage 2: Build
# Stage 2: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++ openssl
WORKDIR /app
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-factor 2 && \
    npm config set fetch-retry-mintimeout 10000 && \
    npm install -g pnpm@9
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm config set fetch-retries 10 && \
    pnpm config set fetch-retry-factor 2 && \
    pnpm config set fetch-retry-mintimeout 20000 && \
    pnpm config set fetch-retry-maxtimeout 120000 && \
    pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json
RUN cd packages/backend && pnpm prisma generate
RUN pnpm run build --filter=@resume-optimizer/backend...

# Deploy the package with production dependencies to a specific directory
RUN pnpm deploy --filter=@resume-optimizer/backend --prod /app/deploy

# Copy built artifacts and other necessary files to the deploy directory
RUN cp -r packages/backend/dist /app/deploy/dist && \
    cp -r packages/backend/prisma /app/deploy/prisma && \
    cp packages/backend/.env.example /app/deploy/.env.example

# Generate Prisma Client in the deploy directory to ensure correct paths
RUN npm install -g prisma@5.22.0 && \
    cd /app/deploy && \
    prisma generate

# Stage 3: Runtime
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy the fully prepared deploy directory
COPY --from=builder --chown=nestjs:nodejs /app/deploy /app

USER nestjs

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "dist/main"]
