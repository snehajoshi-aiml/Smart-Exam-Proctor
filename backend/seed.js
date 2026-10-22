/**
 * Database Seeder Script
 * Run this to populate the database with test data
 * Usage: npm run seed
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const Student = require('./models/Student');
const ExamSession = require('./models/ExamSession');
const ProctoringLog = require('./models/ProctoringLog');

// ========== CREATE MONGODB OBJECTIDS ==========
console.log('🔑 Generating MongoDB ObjectIds for exams...');
const examObjectIds = [];
for (let i = 0; i < 5; i++) {
    const objectId = new mongoose.Types.ObjectId();
    examObjectIds.push(objectId);
    console.log(`   Exam ${i + 1} ObjectId: ${objectId.toString()}`);
}
console.log('');

// Exam names for reference
const examNames = [
    'Computer Science Final',
    'Information Technology Midterm',
    'Engineering Basics',
    'Mathematics Advanced',
    'Physics Fundamentals'
];

// Test data
const testStudents = [
    {
        studentId: 'STU001',
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        course: 'Computer Science',
        semester: '1'
    },
    {
        studentId: 'STU002',
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        course: 'Information Technology',
        semester: '2'
    },
    {
        studentId: 'STU003',
        name: 'Bob Johnson',
        email: 'bob@example.com',
        password: 'password123',
        course: 'Engineering',
        semester: '3'
    },
    {
        studentId: 'STU004',
        name: 'Alice Brown',
        email: 'alice@example.com',
        password: 'password123',
        course: 'Mathematics',
        semester: '4'
    },
    {
        studentId: 'STU005',
        name: 'Charlie Wilson',
        email: 'charlie@example.com',
        password: 'password123',
        course: 'Physics',
        semester: '2'
    }
];

// Test violation types
const testViolations = [
    { type: 'tab_switch', eventType: 'TAB_SWITCH', message: 'Tab switch detected during exam', severity: 'medium' },
    { type: 'multiple_faces', eventType: 'MULTIPLE_FACE', message: 'Multiple faces detected in frame', severity: 'high' },
    { type: 'voice_detected', eventType: 'AUDIO_DETECTED', message: 'Voice detected during exam', severity: 'medium' },
    { type: 'looking_away', eventType: 'LOOKING_AWAY', message: 'Student looking away from screen', severity: 'medium' },
    { type: 'phone_detected', eventType: 'PHONE_DETECTED', message: 'Mobile phone detected', severity: 'high' },
    { type: 'no_face', eventType: 'NO_FACE', message: 'No face detected in frame', severity: 'medium' },
    { type: 'fullscreen_exit', eventType: 'FULLSCREEN_EXIT', message: 'Exited fullscreen mode', severity: 'low' }
];

const seedDatabase = async () => {
    try {
        console.log('🌱 Starting database seeding...');
        console.log('=================================\n');
        
        // Connect to MongoDB
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-proctoring';
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
        console.log(`📊 Database: ${mongoose.connection.name}\n`);

        // Clear existing data
        await Student.deleteMany({});
        await ExamSession.deleteMany({});
        await ProctoringLog.deleteMany({});
        console.log('🗑️  Cleared existing data\n');

        // Create test students
        console.log('📝 Creating test students...');
        const createdStudents = [];
        for (const studentData of testStudents) {
            const student = new Student({
                ...studentData,
                password: studentData.password,
                createdAt: new Date(),
                lastLogin: new Date()
            });
            await student.save();
            createdStudents.push(student);
            console.log(`   ✅ Created: ${student.name} (${student.email})`);
        }
        console.log(`   Total: ${createdStudents.length} students created\n`);

        // Create test exam sessions and logs
        console.log('📝 Creating exam sessions and violation logs...');
        let totalSessions = 0;
        let totalLogs = 0;
        
        for (let i = 0; i < createdStudents.length; i++) {
            const student = createdStudents[i];
            // Use ObjectId from our pre-created array
            const examObjectId = examObjectIds[i % examObjectIds.length];
            const examName = examNames[i % examNames.length];
            const examIdString = examObjectId.toString();
            const sessionId = `${student.studentId}_${examIdString}_${Date.now()}_${i}`;
            
            // Determine session status based on index
            let status = 'active';
            let score = null;
            if (i === 0) {
                status = 'completed';
                score = 85;
            } else if (i === 1) {
                status = 'terminated';
                score = null;
            } else if (i === 2) {
                status = 'active';
                score = null;
            } else if (i === 3) {
                status = 'completed';
                score = 92;
            } else {
                status = 'completed';
                score = 78;
            }
            
            // Create exam session with proper ObjectId
            const session = new ExamSession({
                // Original fields - using ObjectId
                userId: student._id,
                examId: examObjectId, // ✅ This is the MongoDB ObjectId
                startTime: new Date(Date.now() - (Math.random() * 86400000)),
                status: status,
                violationCount: Math.floor(Math.random() * 8),
                metadata: {
                    examName: examName,
                    duration: 60,
                    deviceInfo: {
                        platform: 'Windows',
                        browser: 'Chrome',
                        mobile: false
                    }
                },
                // New fields
                studentId: student.studentId,
                studentName: student.name,
                sessionId: sessionId,
                totalViolations: Math.floor(Math.random() * 8),
                tabSwitches: Math.floor(Math.random() * 5),
                answers: new Map([
                    ['q1', 'A'],
                    ['q2', 'B'],
                    ['q3', 'C']
                ]),
                score: score,
                ipAddress: '192.168.1.' + Math.floor(Math.random() * 255),
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                deviceInfo: {
                    platform: 'Windows',
                    browser: 'Chrome',
                    mobile: false,
                    os: 'Windows 10'
                },
                browserInfo: 'Chrome 120.0.0.0'
            });
            
            await session.save();
            totalSessions++;
            console.log(`   ✅ Session created for: ${student.name} (${status}) - Exam: ${examName}`);

            // Create violation logs for this session
            const violationCount = Math.floor(Math.random() * 10) + 1;
            for (let j = 0; j < violationCount; j++) {
                const violation = testViolations[Math.floor(Math.random() * testViolations.length)];
                const logTime = new Date(session.startTime.getTime() + (j * 300000));
                
                const log = new ProctoringLog({
                    // Original fields - using ObjectId
                    userId: student._id,
                    examId: examObjectId, // ✅ This is the MongoDB ObjectId
                    type: 'violation',
                    message: violation.message,
                    eventType: violation.eventType,
                    metadata: {
                        timestamp: logTime,
                        sessionId: sessionId,
                        confidence: 0.7 + Math.random() * 0.3,
                        details: {
                            count: j + 1,
                            duration: Math.floor(Math.random() * 5) + 1
                        }
                    },
                    // New fields
                    studentId: student.studentId,
                    sessionId: sessionId,
                    violationType: violation.type,
                    severity: violation.severity,
                    details: {
                        message: violation.message,
                        timestamp: logTime,
                        confidence: 0.7 + Math.random() * 0.3,
                        violationNumber: j + 1,
                        sessionId: sessionId
                    },
                    ipAddress: '192.168.1.' + Math.floor(Math.random() * 255),
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    timestamp: logTime
                });
                
                await log.save();
                totalLogs++;
            }
            console.log(`   ✅ Created ${violationCount} violation logs for: ${student.name}`);
        }
        
        console.log(`   Total: ${totalSessions} sessions and ${totalLogs} logs created\n`);

        // Display summary
        console.log('=================================');
        console.log('🎉 Database seeding completed!');
        console.log('=================================\n');
        
        console.log('📊 Summary:');
        console.log(`   • Students: ${createdStudents.length}`);
        console.log(`   • Exam Sessions: ${totalSessions}`);
        console.log(`   • Proctoring Logs: ${totalLogs}`);
        
        console.log('\n📋 Test Credentials:');
        console.log('---------------------------------');
        for (const student of testStudents) {
            console.log(`📧 Email: ${student.email}`);
            console.log(`🔑 Password: ${student.password}`);
            console.log(`🎓 Course: ${student.course}`);
            console.log(`📚 Semester: ${student.semester}`);
            console.log('---------------------------------');
        }
        
        console.log('\n💡 Tips:');
        console.log('   1. Use these credentials to login at http://localhost:5000/exam');
        console.log('   2. Start proctoring to test face/voice detection');
        console.log('   3. Try switching tabs to see violations being logged');
        console.log('   4. Check MongoDB to view all collected data');
        
        console.log('\n🔌 Database connection closed');
        console.log('✅ Seeding completed successfully!\n');
        
        await mongoose.connection.close();
        
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        console.error(error.stack);
        process.exit(1);
    }
};

// Run the seeder
seedDatabase();