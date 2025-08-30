# apps/web/Dockerfile
FROM node:18-bullseye AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1) Copy only manifests for deterministic/cached installs
COPY package.json package-lock.json ./
# Copy each workspace's manifest so npm can build a full graph
COPY apps/backend/package*.json apps/backend/
COPY apps/web/package*.json apps/web/
# If you have a shared UI package, include it too
COPY packages/ui/package*.json packages/ui/

# 2) Install ALL workspaces using the lockfile
RUN npm ci --workspaces --include-workspace-root

# 3) Bring in the rest of the repo
FROM deps AS build
COPY . .

# 4) Build only the web app
RUN npm run -w web build

# 5) Runtime image
FROM node:18-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000
COPY --from=build /app ./
CMD ["npm","run","-w","web","start"]