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

# Build seed.ts → dist/prisma
RUN npx tsc prisma/seed.ts --outDir dist/prisma

# Build NestJS project
RUN npm run build

# Ensure runtime seed can find medicines.json (Nest build recreates dist/)
RUN cp prisma/medicines.json dist/prisma/medicines.json

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
