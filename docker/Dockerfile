##############################
# Base image (minimal, no pnpm needed at runtime)
##############################
FROM node:25-alpine AS base
# Note: useradd is not available in Alpine Linux. User creation is handled in the runtime stage.
# Security: upgrade all packages to latest versions to fix CVEs
RUN apk upgrade --no-cache && \
    apk add --no-cache ca-certificates libc6-compat

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

##############################
# Builder base with pnpm (only for build stages)
##############################
FROM base AS builder-base

RUN npm install -g pnpm@10.11.0

##############################
# All Dependencies (for build)
##############################
FROM builder-base AS deps

RUN apk add --no-cache python3 make g++ pkgconfig libpq-dev

COPY package.json pnpm-lock.yaml .npmrc ./

RUN pnpm install --frozen-lockfile

##############################
# Production Dependencies ONLY
##############################
FROM builder-base AS prod-deps

# Need build tools for native modules (sharp, pg, heic-convert)
RUN apk add --no-cache python3 make g++ pkgconfig libpq-dev vips-dev

COPY package.json pnpm-lock.yaml .npmrc ./

# Tell sharp to use system libvips
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=0

# CI=true is required for pnpm to run in non-interactive mode
ENV CI=true

RUN pnpm fetch --prod
RUN pnpm install --prod --offline --frozen-lockfile --recursive

# Install production deps, then remove wrong-platform binaries
RUN set -eux; cd node_modules/.pnpm; \
    find . -maxdepth 1 -type d -name "@next+swc-*" \
      ! -name "*linux-x64-musl*" \
      ! -name "*linux-arm64-musl*" \
      -exec rm -rf {} +; \
    find . -maxdepth 1 -type d -name "@img+sharp-*" \
      ! -name "*linuxmusl-x64*" \
      ! -name "*linuxmusl-arm64*" \
      -exec rm -rf {} +; \
    find . -maxdepth 1 -type d -name "@img+sharp-libvips-*" \
      ! -name "*linuxmusl-x64*" \
      ! -name "*linuxmusl-arm64*" \
      -exec rm -rf {} +;

##############################
# Build stage
##############################
FROM builder-base AS build

RUN apk add --no-cache python3 make g++ pkgconfig libpq-dev
# Note: useradd is not available in Alpine Linux. User creation is handled in the runtime stage.
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    SKIP_ENV_VALIDATION=1

RUN pnpm run build && \
    rm -rf .next/cache .next/trace

# Verify that the server build output exists
RUN set -ex; \
    echo "==> Verifying build outputs..."; \
    test -f /app/dist-server/server.cjs || (echo "FATAL: dist-server/server.cjs was not created during build!" && ls -la /app/dist-server/ && exit 1); \
    test -d /app/.next/standalone || (echo "FATAL: .next/standalone directory not found!" && exit 1); \
    echo "==> Build verification passed successfully"

##############################
# Runtime stage (minimal, no pnpm)
##############################
FROM base AS runtime

ARG YT_DLP_VERSION=2025.11.12

# Security: upgrade all packages first, then install runtime deps
RUN apk upgrade --no-cache && \
    apk add --no-cache libpq ffmpeg vips && \
    # Clean up npm (not needed, we use node directly)
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack && \
    rm -rf /var/cache/apk/* /tmp/* /root/.npm

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=0 \
    PORT=3000 \
    HOST="0.0.0.0"

# More robust user/group creation
RUN set -e \
    # First check if group exists with different GID
    && getent group norishapp || addgroup -S norishapp \
    # Then check if user exists with different UID
    && getent passwd norish || adduser -S norish -G norishapp \
    # Verify that user and group exist
    && getent passwd norish \
    && getent group norishapp \
    && echo "✅ User norish and group norishapp verified"

# Copy Next.js standalone output (includes minimal node_modules for Next.js itself)
COPY --from=build --chown=norish:norishapp /app/.next/standalone ./

# Copy static assets
COPY --from=build --chown=norish:norishapp /app/.next/static ./.next/static
COPY --from=build --chown=norish:norishapp /app/public ./public

# Copy compiled backend and configs
COPY --from=build --chown=norish:norishapp /app/dist-server ./dist-server
COPY --from=build --chown=norish:norishapp /app/config ./config
COPY --from=build --chown=norish:norishapp /app/server/db ./server/db
COPY --from=build --chown=norish:norishapp /app/server/ai/prompts ./server/ai/prompts

# Copy pruned production node_modules (overwrites/merges with standalone's minimal deps)
COPY --from=prod-deps --chown=norish:norishapp /app/node_modules ./node_modules

# Create uploads, video temp, and binaries directories
RUN mkdir -p /app/uploads/recipes /app/uploads/avatars /app/uploads/video-temp /app/bin && \
    chown -R norish:norishapp /app/uploads /app/bin

# Download yt-dlp standalone binary during build (architecture-specific for Alpine/musl)
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      YT_DLP_BINARY="yt-dlp_musllinux_aarch64"; \
    else \
      YT_DLP_BINARY="yt-dlp_musllinux"; \
    fi && \
    wget -q "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/${YT_DLP_BINARY}" -O /app/bin/yt-dlp && \
    chmod +x /app/bin/yt-dlp

# Final verification before switching user
RUN set -ex; \
    echo "==> Final pre-flight checks before USER directive..."; \
    getent passwd norish > /dev/null 2>&1 || (echo "FATAL: User 'norish' not found in passwd!" && exit 1); \
    id norish > /dev/null 2>&1 || (echo "FATAL: Cannot resolve user 'norish'!" && exit 1); \
    test -d /app || (echo "FATAL: /app directory does not exist!" && exit 1); \
    ls -la /app > /dev/null 2>&1 || (echo "FATAL: Cannot list /app directory!" && exit 1); \
    test -f /app/dist-server/server.cjs || (echo "FATAL: /app/dist-server/server.cjs not found in runtime stage!" && ls -la /app/dist-server/ && exit 1); \
    echo "==> All pre-flight checks passed successfully"

USER norish

EXPOSE 3000

# VOLUME removed - not supported by Railway. Use Railway's Volume system instead
# VOLUME ["/app/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "const port=process.env.PORT||3000; require('http').get(\`http://127.0.0.1:\${port}/api/health\`, r=>process.exit(r.statusCode===200?0:1))" || exit 1

# Run directly with node
CMD ["node", "dist-server/server.cjs"]
