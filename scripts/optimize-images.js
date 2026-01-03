const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets', 'images');
const outputDir = path.join(__dirname, '..', 'assets', 'images', 'optimized');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// List of images to optimize
const images = fs.readdirSync(assetsDir).filter(file => file.endsWith('.png'));

console.log(`🔧 Optimizing ${images.length} images...\n`);

async function optimizeImage(filename) {
  const inputPath = path.join(assetsDir, filename);
  const baseName = path.parse(filename).name;

  // Skip if it's already optimized
  if (filename.includes('optimized')) return;

  const stats = fs.statSync(inputPath);
  const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

  console.log(`📸 Processing: ${filename} (${sizeInMB} MB)`);

  try {
    // Generate WebP version (high quality, much smaller)
    const webpPath = path.join(outputDir, `${baseName}.webp`);
    await sharp(inputPath)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 6 })
      .toFile(webpPath);

    const webpStats = fs.statSync(webpPath);
    const webpSize = (webpStats.size / (1024 * 1024)).toFixed(2);
    const savings = (((stats.size - webpStats.size) / stats.size) * 100).toFixed(1);

    console.log(`✅ Created WebP: ${baseName}.webp (${webpSize} MB, ${savings}% smaller)\n`);

    // Also create optimized PNG fallback (smaller than original)
    const pngPath = path.join(outputDir, filename);
    await sharp(inputPath)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(pngPath);

    const pngStats = fs.statSync(pngPath);
    const pngSize = (pngStats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ Created optimized PNG: ${filename} (${pngSize} MB)\n`);

  } catch (error) {
    console.error(`❌ Error processing ${filename}:`, error.message);
  }
}

async function main() {
  for (const image of images) {
    await optimizeImage(image);
  }

  console.log('\n✨ Image optimization complete!');
  console.log(`📁 Optimized images saved to: ${outputDir}`);
}

main().catch(console.error);
