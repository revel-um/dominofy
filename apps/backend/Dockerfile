# apps/backend/Dockerfile
FROM node:20 AS builder
WORKDIR /app

# copy lockfiles + manifests first (best cache)
COPY package.json package-lock.json ./
COPY apps/backend/package*.json apps/backend/

RUN npm ci

# now bring the whole repo and build only backend
COPY . .
RUN npx turbo run build --filter=backend...

FROM node:20 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./

RUN rm -f .env apps/backend/.env

EXPOSE 3001

# use the workspace script so you don't hardcode a path
CMD ["npm","run","-w","backend","start:prod"]
