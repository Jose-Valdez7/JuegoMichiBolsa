# Server Dockerfile
FROM node:18 AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig*.json ./
COPY prisma ./prisma
RUN npm run prisma:generate
COPY src ./src
RUN npm run build

FROM node:18 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main.js"]
