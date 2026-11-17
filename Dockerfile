FROM node:22-alpine

WORKDIR /app

# Copy package files and install dependencies normally
COPY package*.json ./
RUN npm install

# Copy the rest of the project files
COPY . .

# Start the bot using your memory-capped script
CMD ["npm", "start"]
