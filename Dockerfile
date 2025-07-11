# Use the Node alpine official image
# https://hub.docker.com/_/node
FROM node:lts-alpine

# Install pnpm globally
RUN npm install -g pnpm

# Create and change to the app directory.
WORKDIR /app

# Copy package manifests and lockfile to leverage layer caching
COPY package*.json pnpm-lock.yaml ./

# Install dependencies based on lockfile
RUN pnpm install --frozen-lockfile

# Copy local code to the container image.
COPY . ./

# Make the Clerk publishable key available at build time
ARG PUBLIC_CLERK_PUBLISHABLE_KEY
ENV PUBLIC_CLERK_PUBLISHABLE_KEY=${PUBLIC_CLERK_PUBLISHABLE_KEY}

# Build the app.
RUN pnpm run build

# Serve the app
CMD ["pnpm", "run", "start"]
