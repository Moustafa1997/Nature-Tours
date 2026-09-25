# Use Node.js v22 LTS
FROM node:22-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies (dev deps are needed to build the frontend bundle)
RUN npm ci --legacy-peer-deps

# Bundle app source
COPY . .

# Build the JavaScript files, then drop dev dependencies
RUN npm run build:js && npm prune --omit=dev --legacy-peer-deps

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Expose the port
EXPOSE 8000

# Run as the unprivileged "node" user (needs to write uploaded images)
RUN chown -R node:node /usr/src/app/public/img
USER node

# Docker marks the container unhealthy when the app or database is down
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Run the application
CMD [ "node", "server.js" ]
