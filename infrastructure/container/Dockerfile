# syntax=docker/dockerfile:1.7
FROM node:22.22.2-alpine AS build
ARG NPM_REGISTRY=https://registry.npmjs.org
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY scripts/build-commerce.mjs ./scripts/build-commerce.mjs
COPY apps ./apps
COPY services ./services
COPY packages ./packages
COPY extensions ./extensions
COPY tools ./tools
COPY database ./database
RUN --mount=type=cache,id=shop-npm,target=/root/.npm \
    npm ci --ignore-scripts --prefer-offline --no-audit --no-fund --registry="$NPM_REGISTRY"
RUN npm run build:commerce

FROM node:22.22.2-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S shop && adduser -S -G shop -u 10001 shop
COPY --from=build --chown=shop:shop /workspace/services/commerce/dist ./services/commerce/dist
COPY --from=build --chown=shop:shop /workspace/database ./database
USER 10001
ENTRYPOINT ["node"]
CMD ["services/commerce/dist/ApiMain.js"]
