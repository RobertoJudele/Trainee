# ---- Build stage: compile TypeScript -> dist ----
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Install ALL deps (incl. dev) so we can run tsc
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Runtime stage: production-only deps + compiled JS ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only (sharp/pg native binaries built for linux/amd64 here)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled output from the build stage
COPY --from=builder /app/dist ./dist

# Run as the unprivileged node user
USER node

EXPOSE 8000
CMD ["node", "dist/index.js"]
