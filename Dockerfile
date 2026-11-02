# syntax=docker/dockerfile:1
# Production image for RASD (TanStack Start + Nitro node-server). Runs the same on AWS ECS/Fargate, Azure App Service
# for Containers, Kubernetes or a plain on-premises Docker host.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* .npmrc ./
RUN npm install --legacy-peer-deps --no-audit --no-fund
COPY . .
RUN NITRO_PRESET=node-server npx vite build

FROM node:22-slim
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
COPY --from=build /app/.output ./.output
# `pg` is imported lazily by the server bundle; make sure it is present next to the output
COPY --from=build /app/node_modules/pg ./node_modules/pg
COPY --from=build /app/node_modules/pg-* ./node_modules/
COPY --from=build /app/node_modules/pgpass ./node_modules/pgpass
COPY --from=build /app/node_modules/split2 ./node_modules/split2
COPY --from=build /app/node_modules/postgres-* ./node_modules/
COPY --from=build /app/node_modules/xtend ./node_modules/xtend
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
