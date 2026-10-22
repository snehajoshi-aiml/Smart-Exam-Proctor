/**
 * download-models.js
 * Downloads face-api.js model files from GitHub into public/models/
 * Run with: node scripts/download-models.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');
const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

const MODEL_FILES = [
  // Tiny Face Detector
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  // Face Landmark 68
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  // Face Recognition
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  // Face Expression (optional)
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1',
];

function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, { headers: { 'User-Agent': 'Node.js model-downloader' } }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
        const redirectUrl = response.headers.location;
        response.resume(); // consume response to free memory
        return downloadFile(redirectUrl, destPath, maxRedirects - 1).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
      }

      const file = fs.createWriteStream(destPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          const stats = fs.statSync(destPath);
          if (stats.size === 0) {
            fs.unlinkSync(destPath);
            reject(new Error(`Downloaded file is empty: ${destPath}`));
          } else {
            resolve(stats.size);
          }
        });
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }

  console.log(`\n📁 Downloading face-api.js models to: ${MODELS_DIR}\n`);

  const results = { success: [], failed: [] };

  for (const filename of MODEL_FILES) {
    const url = `${BASE_URL}/${filename}`;
    const destPath = path.join(MODELS_DIR, filename);

    // Check if file already exists and has content
    if (fs.existsSync(destPath)) {
      const existing = fs.statSync(destPath);
      if (existing.size > 100) {
        console.log(`✅ Already exists (${(existing.size / 1024).toFixed(1)} KB): ${filename}`);
        results.success.push(filename);
        continue;
      } else {
        console.log(`⚠️  File is empty/too small (${existing.size} bytes), re-downloading: ${filename}`);
        fs.unlinkSync(destPath);
      }
    }

    process.stdout.write(`⬇️  Downloading: ${filename}... `);

    try {
      const size = await downloadFile(url, destPath);
      console.log(`✅ ${(size / 1024).toFixed(1)} KB`);
      results.success.push(filename);
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      results.failed.push({ filename, error: err.message });
    }
  }

  console.log('\n========== Download Summary ==========');
  console.log(`✅ Downloaded: ${results.success.length}/${MODEL_FILES.length}`);

  if (results.failed.length > 0) {
    console.log(`❌ Failed: ${results.failed.length}`);
    results.failed.forEach(f => console.log(`   - ${f.filename}: ${f.error}`));
    console.log('\n💡 If downloads fail, manually download from:');
    console.log('   https://github.com/justadudewhohacks/face-api.js/tree/master/weights');
    console.log(`   and place files in: ${MODELS_DIR}`);
  } else {
    console.log('\n🎉 All models downloaded successfully! Ready for face detection.');
  }
}

main().catch(console.error);
