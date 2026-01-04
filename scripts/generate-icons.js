const sharp = require('sharp');
const path = require('path');

const input = path.join(__dirname, '..', 'assets', 'images', 'optimized', 'Logo Default.png');
const outputDir = path.join(__dirname, '..', 'public');

const sizes = [192, 512];

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);

    try {
      await sharp(input)
        .resize(size, size, { fit: 'contain', background: { r: 10, g: 10, b: 18, alpha: 1 } })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);

      console.log(`✅ Created icon-${size}.png`);
    } catch (error) {
      console.error(`❌ Error creating ${size}px icon:`, error.message);
    }
  }

  console.log('\n✨ Icon generation complete!');
}

generateIcons();
