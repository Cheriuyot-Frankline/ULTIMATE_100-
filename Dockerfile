FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Clean npm cache and install without strict integrity blockers
RUN npm cache clean --force && npm install --no-audit

# Copy the rest of the project files
COPY . .

# Start the bot using your memory-capped script
CMD ["npm", "start"]
