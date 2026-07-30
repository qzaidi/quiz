#!/usr/bin/env node

/**
 * Production build script.
 *
 * Builds an optimized copy of public/ into dist/:
 * - Our own JS/CSS files are minified and renamed with a content hash
 *   (e.g. app.js -> app-3f9a1c2e.js) so they can be cached immutably
 *   forever; any change produces a new filename and busts the cache.
 * - HTML files are minified and their asset references rewritten to the
 *   hashed filenames. HTML itself is served with no-cache so it is always
 *   revalidated after a deploy.
 * - Everything else (lib/, img/, logo.png, ...) is copied unchanged.
 *
 * The source files in public/ are never modified, so `npm run dev`
 * keeps working against the originals.
 */

import { readFileSync, writeFileSync, rmSync, cpSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyCss } from 'csso';
import { minify as minifyJs } from 'terser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');
const distDir = join(__dirname, '../dist');

// Our own cache-busted assets (vendored files under lib/ keep their names)
const hashedAssets = [
    'style.css',
    'locales.js',
    'common.js',
    'app.js',
    'admin.js',
];

const htmlFiles = ['index.html', 'admin.html'];

console.log('🔨 Building production assets...\n');

// Start from a clean copy of public/
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
cpSync(publicDir, distDir, { recursive: true });

let totalOriginal = 0;
let totalMinified = 0;
const hashedNames = {}; // original name -> hashed name

// Minify and content-hash our own assets
for (const file of hashedAssets) {
    const filePath = join(distDir, file);
    try {
        const original = readFileSync(filePath, 'utf8');
        const originalSize = Buffer.byteLength(original, 'utf8');
        totalOriginal += originalSize;

        let minified = original;
        if (file.endsWith('.css')) {
            minified = minifyCss(original).css;
        } else if (file.endsWith('.js')) {
            const result = await minifyJs(original, {
                compress: {
                    dead_code: true,
                    drop_debugger: true,
                    conditionals: true,
                    evaluate: true,
                },
                mangle: {
                    toplevel: false, // scripts share globals via window
                },
                format: {
                    comments: false,
                },
            });
            minified = result.code;
        }

        const hash = createHash('sha256').update(minified).digest('hex').slice(0, 8);
        const hashed = file.replace(/\.([^.]+)$/, `-${hash}.$1`);
        hashedNames[file] = hashed;

        rmSync(filePath);
        writeFileSync(join(distDir, hashed), minified, 'utf8');

        const minifiedSize = Buffer.byteLength(minified, 'utf8');
        totalMinified += minifiedSize;
        const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
        console.log(`  ✅ ${file} → ${hashed}: ${formatBytes(originalSize)} → ${formatBytes(minifiedSize)} (-${savings}%)`);
    } catch (err) {
        console.error(`  ❌ Error processing ${file}:`, err.message);
        process.exitCode = 1;
    }
}

// Rewrite asset references and minify HTML
for (const file of htmlFiles) {
    const filePath = join(distDir, file);
    try {
        let html = readFileSync(filePath, 'utf8');
        const originalSize = Buffer.byteLength(html, 'utf8');
        totalOriginal += originalSize;

        for (const [original, hashed] of Object.entries(hashedNames)) {
            // Match src="app.js" / href="style.css" (with optional quotes/whitespace variations)
            html = html.replaceAll(`"${original}"`, `"${hashed}"`);
        }

        html = await minifyHtml(html, {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            useShortDoctype: true,
            minifyCss: true,
            minifyJs: true,
        });

        writeFileSync(filePath, html, 'utf8');

        const minifiedSize = Buffer.byteLength(html, 'utf8');
        totalMinified += minifiedSize;
        const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
        console.log(`  ✅ ${file}: ${formatBytes(originalSize)} → ${formatBytes(minifiedSize)} (-${savings}%)`);
    } catch (err) {
        console.error(`  ❌ Error processing ${file}:`, err.message);
        process.exitCode = 1;
    }
}

if (process.exitCode) {
    console.error('\n❌ Build failed.\n');
} else {
    const totalSavings = ((1 - totalMinified / totalOriginal) * 100).toFixed(1);
    console.log(`\n📊 Total: ${formatBytes(totalOriginal)} → ${formatBytes(totalMinified)} (-${totalSavings}%)`);
    console.log('✨ Build complete! Optimized assets written to dist/.\n');
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
