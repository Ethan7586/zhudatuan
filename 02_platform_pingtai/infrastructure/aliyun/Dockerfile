FROM node:22.22.0-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY 04_tools/scripts/build-commerce.mjs ./04_tools/scripts/build-commerce.mjs
COPY apps ./apps
COPY services ./services
COPY packages ./packages
COPY extensions ./extensions
COPY tools ./tools
COPY database ./database
RUN npm ci --ignore-scripts
RUN npm run build:commerce

FROM node:22.22.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S shop && adduser -S -G shop -u 10001 shop
COPY --from=build --chown=shop:shop /workspace/services/commerce/dist ./services/commerce/dist
COPY --from=build --chown=shop:shop /workspace/database ./database
USER 10001
ENTRYPOINT ["node"]
CMD ["01_core_hexin/services/commerce/dist/ApiMain.js"]
