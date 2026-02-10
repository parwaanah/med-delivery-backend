# ---- Base Image ----
FROM node:18

# App Directory
WORKDIR /app

# Install Nest CLI
RUN npm install -g @nestjs/cli

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy full project
COPY . .

# Generate medicines.json DURING BUILD
RUN node prisma/generate_medicines.js

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS project
RUN npm run build

# Backward-compatible entrypoint: some older configs expect dist/src/main.js
RUN mkdir -p dist/src && cp dist/main.js dist/src/main.js

# Build seed.ts -> dist/prisma (Nest build recreates dist/) and ensure medicines.json is present at runtime
RUN mkdir -p dist/prisma \
  && npx tsc prisma/seed.ts --outDir dist/prisma \
  && cp prisma/medicines.json dist/prisma/medicines.json

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
