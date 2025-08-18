# Use official Node.js runtime as a base image
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first (for caching layers)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application
COPY . .

# Expose port (adjust if your backend uses a different one)
EXPOSE 8000

# Start the app
CMD ["npm", "start"]