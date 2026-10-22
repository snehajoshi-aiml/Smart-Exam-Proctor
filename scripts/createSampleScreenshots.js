const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, '../backend/screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// 1x1 Minimal valid JPEG base64 string
const sampleJpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

const filesToCreate = [
  { name: 'enrolled_subhash_k_face.jpg' },
  { name: 'verification_subhash_k_verified.jpg' },
  { name: 'proctoring_snapshot_john_doe.jpg' },
  { name: 'violation_gaze_shift_snapshot.jpg' }
];

filesToCreate.forEach(f => {
  const filePath = path.join(screenshotsDir, f.name);
  fs.writeFileSync(filePath, Buffer.from(sampleJpegBase64, 'base64'));
  console.log(`📸 Created photo file: ${filePath}`);
});

console.log('✅ Created 4 photo files in backend/screenshots folder!');
