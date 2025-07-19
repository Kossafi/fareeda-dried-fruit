FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../../packages/types/package.json ./packages/types/
COPY ../../packages/utils/package.json ./packages/utils/

# Install dependencies
RUN npm ci --only=production

# Copy shared packages
COPY ../../packages ./packages

# Build shared packages
RUN cd packages/types && npm run build
RUN cd packages/utils && npm run build

# Copy source code
COPY . .

# Build application
RUN npm run build

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start application
CMD ["npm", "start"]