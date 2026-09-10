FROM node:22.22.0-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY 04_tools/scripts/build-commerce.mjs ./04_tools/scripts/build-commerce.mjs
COPY 01_core_hexin/apps ./01_core_hexin/apps
COPY 01_core_hexin/services ./01_core_hexin/services
COPY 01_core_hexin/packages ./01_core_hexin/packages
COPY 01_core_hexin/extensions ./01_core_hexin/extensions
COPY 04_tools/tools ./04_tools/tools
COPY 02_platform_pingtai/database ./02_platform_pingtai/database
COPY 02_platform_pingtai/config ./02_platform_pingtai/config
RUN npm ci --ignore-scripts
RUN npm run build:commerce

FROM node:22.22.0-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S shop && adduser -S -G shop -u 10001 shop
COPY --from=build --chown=shop:shop /workspace/01_core_hexin/services/commerce/dist ./01_core_hexin/services/commerce/dist
COPY --from=build --chown=shop:shop /workspace/02_platform_pingtai/database ./02_platform_pingtai/database
USER 10001
ENTRYPOINT ["node"]
CMD ["01_core_hexin/services/commerce/dist/ApiMain.js"]
