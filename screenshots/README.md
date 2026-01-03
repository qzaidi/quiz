# Screenshots

This directory contains screenshots captured by Playwright E2E tests and displayed in the main README.md.

## How to Update Screenshots

1. Run the screenshot tests:
   ```bash
   npm run test:screenshots
   ```

2. The tests will capture screenshots at key points:
   - Homepage view
   - Quiz listing
   - Question interface
   - Mobile views

3. Commit the screenshots:
   ```bash
   git add screenshots/*.png
   git commit -m "docs: update screenshots"
   ```

## Current Screenshots

These screenshots are automatically generated from `tests/e2e/screenshots.spec.js`.

To modify what's captured, edit that test file and rerun `npm run test:screenshots`.
