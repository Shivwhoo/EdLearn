FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Build Next.js application
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Expose Next.js port
EXPOSE 3000

CMD ["npm", "start"]
