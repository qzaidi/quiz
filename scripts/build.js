#!/usr/bin/env node

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyCss } from 'csso';
import { minify as minifyJs } from 'terser';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');

const isProduction = process.env.NODE_ENV === 'production';

console.log(`🔨 Building in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode...\n`);

// Files to minify
const files = [
    // HTML
    'index.html',
    'admin.html',

    // CSS
    'style.css',

    // JavaScript
    'locales.js',
    'common.js',
    'app.js',
    'admin.js',
];

let totalOriginal = 0;
let totalMinified = 0;

for (const file of files) {
    const filePath = join(publicDir, file);

    try {
        const original = readFileSync(filePath, 'utf8');
        const originalSize = Buffer.byteLength(original, 'utf8');
        totalOriginal += originalSize;

        let minified = original;
        let minifiedSize = originalSize;

        if (isProduction) {
            const ext = file.split('.').pop();

            if (ext === 'html') {
                minified = await minifyHtml(original, {
                    collapseWhitespace: true,
                    removeComments: true,
                    removeRedundantAttributes: true,
                    removeScriptTypeAttributes: true,
                    removeStyleLinkTypeAttributes: true,
                    useShortDoctype: true,
                    minifyCss: true,
                    minifyJs: true,
                });
            } else if (ext === 'css') {
                const result = minifyCss(original);
                minified = result.css;
            } else if (ext === 'js') {
                const result = await minifyJs(original, {
                    compress: {
                        dead_code: true,
                        drop_debugger: true,
                        conditionals: true,
                        evaluate: true,
                    },
                    mangle: {
                        toplevel: false,
                    },
                    format: {
                        comments: false,
                    },
                });
                minified = result.code;
            }

            minifiedSize = Buffer.byteLength(minified, 'utf8');
            totalMinified += minifiedSize;

            // Only write if there's actual change
            if (minified !== original) {
                writeFileSync(filePath, minified, 'utf8');
                const savings = ((1 - minifiedSize / originalSize) * 100).toFixed(1);
                console.log(`  ✅ ${file}: ${formatBytes(originalSize)} → ${formatBytes(minifiedSize)} (-${savings}%)`);
            } else {
                console.log(`  ℹ️  ${file}: Already optimized (${formatBytes(originalSize)})`);
            }
        } else {
            console.log(`  📋 ${file}: ${formatBytes(originalSize)} (skipped in development)`);
        }
    } catch (err) {
        console.error(`  ❌ Error processing ${file}:`, err.message);
    }
}

if (isProduction) {
    const totalSavings = ((1 - totalMinified / totalOriginal) * 100).toFixed(1);
    console.log(`\n📊 Total: ${formatBytes(totalOriginal)} → ${formatBytes(totalMinified)} (-${totalSavings}%)\n`);
    console.log('✨ Build complete! Files are minified for production.\n');
} else {
    console.log(`\n📊 Total size: ${formatBytes(totalOriginal)}\n`);
    console.log('ℹ️  Development mode - files not minified. Use NODE_ENV=production to minify.\n');
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
