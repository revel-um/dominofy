# apps/web/Dockerfile
FROM node:18-bullseye AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
COPY apps/web/package*.json apps/web/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run -w web build

FROM node:18-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000
COPY --from=build /app ./
CMD ["npm","run","-w","web","start"]
