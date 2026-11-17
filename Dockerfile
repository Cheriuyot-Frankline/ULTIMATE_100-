FROM node:22-alpine

WORKDIR /app

# Copy only package.json to avoid lockfile mismatch issues
COPY package.json ./

# Remove any old lockfile if present and install fresh packages
RUN rm -f package-lock.json && npm install --no-audit

# Copy the rest of the project files
COPY . .

# Start the bot using your memory-capped script
CMD ["npm", "start"]
