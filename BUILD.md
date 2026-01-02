# Production Build

This project includes automatic minification and compression for production deployments.

## Development vs Production

### Development Mode
```bash
npm run dev
# or
NODE_ENV=development npm start
```
- Files are served as-is (not minified)
- No caching headers
- Full error logging

### Production Mode
```bash
# First, build the minified assets
npm run build

# Then start the server
npm start
```

- All HTML, CSS, and JavaScript files are minified
- Gzip compression enabled for all responses
- Static files cached for 1 year
- Optimized for performance

## Build Script

The build script (`scripts/build.js`) minifies:

**HTML:**
- `public/index.html`
- `public/admin.html`

**CSS:**
- `public/style.css`

**JavaScript:**
- `public/locales.js`
- `public/common.js`
- `public/app.js`
- `public/admin.js`

### What Gets Minified

When `NODE_ENV=production`, the build script:

1. **HTML:** Removes whitespace, comments, redundant attributes
2. **CSS:** Removes whitespace, comments, unnecessary characters
3. **JavaScript:** Compresses code, removes comments, dead code elimination, mangles variable names (local scope only)

### Typical Savings

You can expect 20-40% size reduction on text files:
- HTML: ~30-40% smaller
- CSS: ~20-30% smaller
- JavaScript: ~30-40% smaller

## Adding Compression

The app uses `express-compression` middleware to gzip all responses:
- HTML, CSS, JS: Additional 60-70% reduction
- Combined with minification: 70-80% total size reduction

## Deployment

For Docker deployments, add to your `Dockerfile`:

```dockerfile
# Install dev dependencies for build
RUN npm install
RUN NODE_ENV=production npm run build

# Remove dev dependencies to keep image small
RUN npm prune --production
```

## CI/CD Update

Update `.github/workflows/docker.yml` to run the build step:

```yaml
- name: Build production assets
  run: |
    npm install
    NODE_ENV=production npm run build
```

Then build the Docker image as usual.
