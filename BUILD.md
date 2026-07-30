# Production Build

This project includes automatic minification, compression, and cache-busting
for production deployments.

## Development vs Production

### Development Mode
```bash
npm run dev
# or
NODE_ENV=development npm start
```
- Files are served as-is from `public/` (not minified)
- No caching headers
- Full error logging

### Production Mode
```bash
# First, build the optimized assets
npm run build

# Then start the server
npm start
```

- All HTML, CSS, and JavaScript files are minified into `dist/`
- Gzip compression enabled for all responses
- Source files in `public/` are never modified

## Build Script

The build script (`scripts/build.js`) copies `public/` to `dist/` and processes:

**JavaScript / CSS (minified + content-hashed):**
- `style.css`, `locales.js`, `common.js`, `app.js`, `admin.js`
- Output as e.g. `app-3f9a1c2e.js` — the hash comes from the minified
  content, so any code change produces a new filename

**HTML (minified, references rewritten):**
- `index.html`, `admin.html` — script/link tags are rewritten to point at
  the hashed filenames

Everything else (`lib/`, `img/`, `logo.png`, ...) is copied unchanged.

## Cache Strategy

The whole point of the content hash is that caching can be aggressive
without ever serving stale code:

| Asset | Cache-Control | Why |
|---|---|---|
| Hashed JS/CSS | `public, max-age=31536000, immutable` | New content = new filename, so old cache entries are simply never requested again |
| HTML | `no-cache` | Always revalidated (cheap 304 via ETag), so a new deploy referencing new hashed files takes effect immediately |
| `lib/`, `img/` | `public, max-age=31536000, immutable` (production) | Vendored/static files that rarely change |

The server only uses `dist/` when it exists **and** `NODE_ENV=production`;
otherwise it falls back to `public/` (which is also always mounted for
runtime-generated files like QR code images).

## Typical Savings

- JavaScript: ~40-60% smaller
- CSS: ~30% smaller
- HTML: ~35-40% smaller
- Plus gzip compression on top of all text responses

## Deployment

The Docker image builds assets automatically — see `Dockerfile`:

```dockerfile
RUN npm install
RUN npm run build
RUN npm prune --production
```

## CI/CD Update

If you build outside Docker, run the build step before packaging:

```yaml
- name: Build production assets
  run: |
    npm install
    npm run build
```
