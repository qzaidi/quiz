FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy application files
COPY . .

# Build and minify assets for production
#RUN NODE_ENV=production npm run build

# Remove dev dependencies to keep image small
RUN npm prune --production

EXPOSE 3000

CMD [ "npm", "start" ]
