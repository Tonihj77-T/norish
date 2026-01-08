# Stage 1: Build the application
FROM node:20-bookworm AS builder
WORKDIR /app

# Install all dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN corepack enable && pnpm install --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# Provide dummy env vars required for the build process
# These are build-time variables and will not be included in the final image
ARG DATABASE_URL="postgresql://postgres:postgres@localhost:5432/norish"
ENV DATABASE_URL=${DATABASE_URL}
ENV SKIP_ENV_VALIDATION=1

# Build the application
RUN pnpm run build

# Stage 2: Production image
FROM node:20-bookworm
WORKDIR /app

# Copy production dependency manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Install only production dependencies
RUN corepack enable && pnpm install --prod --frozen-lockfile

# Copy built artifacts from the builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/next.config.js ./next.config.js

# Set production environment and expose port
ENV NODE_ENV=production
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
