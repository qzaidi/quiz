#!/bin/bash

# Image Optimization Script for Quiz Logos
# Optimizes PNG/JPG images in public/img for web use

set -e

IMAGE_DIR="public/img"
BACKUP_DIR="public/img.backup"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🖼️  Quiz Logo Image Optimizer${NC}"
echo "================================"
echo ""

# Check if image directory exists
if [ ! -d "$IMAGE_DIR" ]; then
    echo -e "${RED}❌ Error: Directory '$IMAGE_DIR' not found!${NC}"
    exit 1
fi

# Check if there are any images
IMAGE_COUNT=$(find "$IMAGE_DIR" -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) | wc -l | tr -d ' ')
if [ "$IMAGE_COUNT" -eq 0 ]; then
    echo -e "${RED}❌ No images found in '$IMAGE_DIR'${NC}"
    exit 1
fi

echo "Found $IMAGE_COUNT image(s) to optimize"
ls -1 "$IMAGE_DIR"
echo ""

# Create backup
echo -e "${BLUE}📦 Creating backup...${NC}"
if [ -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}⚠️  Backup directory already exists, skipping backup...${NC}"
    backup_created=false
else
    mkdir -p "$BACKUP_DIR"
    cp -r "$IMAGE_DIR"/* "$BACKUP_DIR/"
    echo -e "${GREEN}✅ Backup created at $BACKUP_DIR${NC}"
    backup_created=true
fi
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Error: Docker is not installed or not in PATH${NC}"
    echo "Please install Docker to use this script"
    exit 1
fi

echo -e "${BLUE}🔧 Building optimization image (first time only)...${NC}"
# Build the optimization image for the current platform
docker build -f Dockerfile.imageoptim -t quiz-imageoptim . > /dev/null 2>&1 || \
docker build -f Dockerfile.imageoptim -t quiz-imageoptim .

echo -e "${BLUE}🔧 Optimizing images...${NC}"
echo ""

# Run optimization using Docker with sh (Alpine default)
docker run --rm \
    -v "$(pwd)/$IMAGE_DIR:/$IMAGE_DIR" \
    quiz-imageoptim \
    /bin/sh -c "
        find /$IMAGE_DIR -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) | while read img; do
            filename=\$(basename \"\$img\")
            echo \"Processing \$filename...\"

            # Get original size
            original_size=\$(stat -c%s \"\$img\" 2>/dev/null || stat -f%z \"\$img\")

            # Resize image to max 800px (maintains aspect ratio)
            # This is 2x the display size (400px) for retina displays
            convert \"\$img\" -resize '800x800>' \"\$img.tmp\" 2>/dev/null
            mv \"\$img.tmp\" \"\$img\"

            # Get size after resize
            resized_size=\$(stat -c%s \"\$img\" 2>/dev/null || stat -f%z \"\$img\")

            if [ \"\$original_size\" -gt \"\$resized_size\" ]; then
                resize_reduction=\$((100 - (resized_size * 100 / original_size)))
                echo \"  📐 Resized: saved \${resize_reduction}%\"
            fi

            # For PNG: Use pngcrush (lossless compression)
            if echo \"\$filename\" | grep -iq \"\\.png\$\"; then
                pngcrush -rem alla -rem gAMA -rem cHRM -rem iCCP -rem sRGB \
                    -l 9 -reduce \"\$img\" \"\$img.tmp\" 2>/dev/null
                mv \"\$img.tmp\" \"\$img\"
            # For JPG: Use jpegoptim (lossy compression)
            elif echo \"\$filename\" | grep -iqE '\\.(jpg|jpeg)$'; then
                jpegoptim --max=85 --strip-all \"\$img\" 2>/dev/null
            fi

            new_size=\$(stat -c%s \"\$img\" 2>/dev/null || stat -f%z \"\$img\")

            if [ \"\$original_size\" -gt \"\$new_size\" ]; then
                reduction=\$((100 - (new_size * 100 / original_size)))
                echo \"  ✅ Total reduction: \${reduction}%\"
            else
                echo \"  ℹ️  Already optimized\"
            fi
        done

        echo ''
        echo '✅ Optimization complete!'
    "

echo ""
echo -e "${BLUE}📊 Results:${NC}"
echo "----------"

# Calculate total savings
if [ "$backup_created" = true ]; then
    BACKUP_BYTES=$(du -sb "$BACKUP_DIR" | cut -f1)
    OPTIMIZED_BYTES=$(du -sb "$IMAGE_DIR" | cut -f1)
    SAVED_BYTES=$((BACKUP_BYTES - OPTIMIZED_BYTES))

    if [ $BACKUP_BYTES -gt 0 ] && [ $OPTIMIZED_BYTES -gt 0 ]; then
        PERCENT_REDUCTION=$((SAVED_BYTES * 100 / BACKUP_BYTES))

        # Convert to human readable
        BACKUP_SIZE=$(numfmt --to=iec-i --suffix=B $BACKUP_SIZE 2>/dev/null || du -h "$BACKUP_DIR" | cut -f1)
        OPTIMIZED_SIZE=$(numfmt --to=iec-i --suffix=B $OPTIMIZED_BYTES 2>/dev/null || du -h "$IMAGE_DIR" | cut -f1)
        SAVED_SIZE=$(numfmt --to=iec-i --suffix=B $SAVED_BYTES 2>/dev/null || echo "~$(($SAVED_BYTES / 1024))KB")

        echo "Original size:  $BACKUP_SIZE"
        echo "Optimized size: $OPTIMIZED_SIZE"
        echo "Space saved:   $SAVED_SIZE ($PERCENT_REDUCTION%)"
    fi
fi

echo "Backup location: $BACKUP_DIR"
echo ""

# List all optimized images
echo -e "${BLUE}Optimized files:${NC}"
find "$IMAGE_DIR" -type f | while read file; do
    size=$(du -h "$file" | cut -f1)
    name=$(basename "$file")
    echo "  - $name ($size)"
done

echo ""
echo -e "${GREEN}✨ Done! Your quiz logos are optimized for the web.${NC}"
echo ""
echo "To restore originals if needed:"
echo "  rm -rf $IMAGE_DIR"
echo "  mv $BACKUP_DIR $IMAGE_DIR"
echo ""
echo "To remove backup (after verifying everything works):"
echo "  rm -rf $BACKUP_DIR"
