const mongoose = require('mongoose');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart-proctoring');
    console.log('Connected to MongoDB');

    const testIds = ['STU_TEST', 'STU_DEMO', 'demoUser123', 'TEST', 'DEMO'];

    const r1 = await mongoose.connection.collection('suspiciousactivities').deleteMany({
      $or: [
        { studentId: { $in: testIds } },
        { studentName: { $in: ['TEST', 'DEMO', 'Demo Student', 'Test Student'] } }
      ]
    });

    const r2 = await mongoose.connection.collection('livesessions').deleteMany({
      $or: [
        { studentId: { $in: testIds } },
        { studentName: { $in: ['TEST', 'DEMO', 'Demo Student', 'Test Student'] } }
      ]
    });

    const r3 = await mongoose.connection.collection('students').deleteMany({
      $or: [
        { studentId: { $in: testIds } },
        { name: { $in: ['TEST', 'DEMO', 'Demo Student', 'Test Student'] } }
      ]
    });

    const r4 = await mongoose.connection.collection('proctoringlogs').deleteMany({
      $or: [
        { studentId: { $in: testIds } }
      ]
    });

    console.log('CLEANUP RESULT:', {
      suspiciousActivitiesDeleted: r1.deletedCount,
      liveSessionsDeleted: r2.deletedCount,
      studentsDeleted: r3.deletedCount,
      proctoringLogsDeleted: r4.deletedCount
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Cleanup error:', err);
    process.exit(1);
  }
}

cleanup();
