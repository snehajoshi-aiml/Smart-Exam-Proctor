const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function migrate() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smart-proctoring');
  const db = mongoose.connection.db;

  const profiles = await db.collection('faceprofiles').find({}).toArray();
  console.log(`Checking ${profiles.length} face profiles for dimension upgrade...`);

  for (const fp of profiles) {
    const dim = fp.embeddings?.[0]?.length;
    console.log(`Profile: ${fp.email} (${fp.studentId}), Current dim: ${dim}`);

    if (dim === 512) {
      console.log(`  ✓ Already 512-d ArcFace. Skipping.`);
      continue;
    }

    console.log(`  🔄 Upgrading ${fp.email} from ${dim}d to 512d ArcFace...`);

    const frames = [];
    if (fp.enrollmentImages && fp.enrollmentImages.length > 0) {
      for (const imgUrl of fp.enrollmentImages) {
        const filename = path.basename(imgUrl);
        const filePath = path.join(__dirname, 'screenshots', filename);
        if (fs.existsSync(filePath)) {
          const data = fs.readFileSync(filePath);
          frames.push('data:image/jpeg;base64,' + data.toString('base64'));
        }
      }
    }

    if (frames.length === 0) {
      console.log(`  ⚠️ No images on disk for ${fp.email}. Cannot auto-migrate without images.`);
      continue;
    }

    const baseCount = frames.length;
    while (frames.length < 20) {
      frames.push(frames[frames.length % baseCount]);
    }

    try {
      const res = await axios.post('http://127.0.0.1:8001/api/arcface/enroll', {
        studentId: fp.studentId,
        frames: frames
      }, { timeout: 25000 });

      if (res.data && res.data.success && res.data.embeddings) {
        const embeddings = res.data.embeddings;
        const avg = res.data.averageEmbedding;
        console.log(`  ✅ Python generated ${embeddings.length} 512d embeddings for ${fp.email}!`);

        await db.collection('faceprofiles').updateOne(
          { _id: fp._id },
          {
            $set: {
              embeddings: embeddings,
              averageEmbedding: avg,
              modelVersion: 'InsightFace-ArcFace (buffalo_s 512d CPU)',
              updatedAt: new Date()
            }
          }
        );

        await db.collection('faceembeddings').updateOne(
          { $or: [{ studentId: fp.studentId }, { email: fp.email }] },
          {
            $set: {
              embeddings: embeddings,
              embedding: avg,
              faceEnrolled: true,
              updatedAt: new Date()
            }
          }
        );

        await db.collection('students').updateOne(
          { $or: [{ studentId: fp.studentId }, { email: fp.email }] },
          {
            $set: {
              faceEmbeddings: embeddings,
              faceEnrolled: true,
              verificationStatus: 'Enrolled',
              updatedAt: new Date()
            }
          }
        );

        await db.collection('users').updateOne(
          { email: fp.email },
          {
            $set: {
              faceEmbeddings: embeddings,
              faceEnrolled: true
            }
          }
        );

        console.log(`  🎉 Successfully migrated ${fp.email} to 512d ArcFace in all collections!`);
      } else {
        console.log(`  ❌ Python enrollment failed for ${fp.email}:`, res.data);
      }
    } catch (e) {
      console.error(`  ❌ Error calling Python enrollment for ${fp.email}:`, e.message);
    }
  }

  await mongoose.disconnect();
  console.log('Migration check complete.');
}

migrate().catch(console.error);
