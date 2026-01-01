# Image Optimization

## Optimize Quiz Logos

To compress and optimize the quiz logo images in `public/img`:

```bash
./optimize-images.sh
```

### What it does:
- Creates a backup in `public/img.backup`
- Builds a local Docker image with optimization tools (first run only)
- Resizes images to max 800x800px (maintaining aspect ratio)
- Uses Docker to run `pngcrush` and `jpegoptim`
- Compresses images for web (lossless for PNG, quality 85 for JPG)
- Shows before/after file sizes

### Requirements:
- Docker installed and running
- The script builds `Dockerfile.imageoptim` to create the `quiz-imageoptim` image locally

### Restore originals (if needed):
```bash
rm -rf public/img
mv public/img.backup public/img
```

### Clean up backup (after verifying):
```bash
rm -rf public/img.backup
```

## Current Images

- alhadi.png
- askari.png
- hasan.png
- imamali.png
- quran.png
- ramadan.png

## Image Guidelines

- **Format**: PNG or JPG
- **Recommended size**: 1024x1024px or smaller (will be resized to 800x800px max)
- **Purpose**: Quiz cover images (displayed in quiz cards and lobby)
- **Optimization**: Run the optimize script before committing to keep repository size small
- **Note**: Images larger than 800x800px will be automatically resized while maintaining aspect ratio
