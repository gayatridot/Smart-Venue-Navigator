FROM node:20-alpine

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build production assets
RUN npm run build

# Clean up dev dependencies
RUN npm prune --production

ENV PORT 8080
EXPOSE 8080

CMD [ "npm", "start" ]
