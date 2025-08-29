# apps/backend/Dockerfile
FROM node:18 AS builder
WORKDIR /app

# Bring in the whole repo so relative imports to /shared work
COPY . .

# Install all workspaces (fast if you have a lockfile)
RUN npm ci

# Build ONLY the backend workspace (web won't build)
RUN npx turbo run build --filter=backend...

# --- Runtime image ---
FROM node:18 AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy the built repo
COPY --from=builder /app ./

EXPOSE 3001
# Start only the backend workspace
CMD ["npm", "run", "start:prod", "-w", "backend"]
