// backend/test/proctoring.test.js
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const API_PREFIX = '/api/proctoring';
const TEST_TOKEN = process.env.TEST_TOKEN || 'your-test-token-here';
const TEST_EXAM_ID = process.env.TEST_EXAM_ID || 'test-exam-123';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-456';

// Create axios instance with default headers
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
    },
    timeout: 10000
});

/**
 * Test 1: Get device information
 */
async function testGetDeviceInfo() {
    console.log('\n📱 Testing: Get Device Info');
    try {
        const response = await api.get(`${API_PREFIX}/device-info`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log('✅ Device Info:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Device Info Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 2: Validate device
 */
async function testValidateDevice() {
    console.log('\n🔍 Testing: Validate Device');
    try {
        const response = await api.get(`${API_PREFIX}/validate-device`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log('✅ Device Validation:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Device Validation Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 3: Start proctoring with detection
 */
async function testStartProctoring() {
    console.log('\n🚀 Testing: Start Proctoring');
    try {
        const response = await api.post(`${API_PREFIX}/start-detection`, {
            examId: TEST_EXAM_ID,
            userId: TEST_USER_ID,
            enableProctoring: true
        }, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'x-enable-proctoring': 'true',
                'x-exam-id': TEST_EXAM_ID
            }
        });
        console.log('✅ Proctoring Started:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Proctoring Start Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 4: Get detection status
 */
async function testGetDetectionStatus(sessionId) {
    console.log('\n📊 Testing: Get Detection Status');
    try {
        const response = await api.get(`${API_PREFIX}/detection-status/${sessionId || 'active'}`);
        console.log('✅ Detection Status:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Detection Status Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 5: Get suspicious activities
 */
async function testGetSuspiciousActivities(examId) {
    console.log('\n🚨 Testing: Get Suspicious Activities');
    try {
        const response = await api.get(`${API_PREFIX}/suspicious-activities/${examId || TEST_EXAM_ID}`, {
            params: {
                limit: 10,
                severity: 'high'
            }
        });
        console.log('✅ Suspicious Activities:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Suspicious Activities Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 6: Report a violation
 */
async function testReportViolation() {
    console.log('\n⚠️ Testing: Report Violation');
    try {
        const violationData = {
            examId: TEST_EXAM_ID,
            userId: TEST_USER_ID,
            type: 'phone_detection',
            severity: 'high',
            details: {
                headDown: true,
                phoneDetected: true,
                earphonesDetected: false,
                booksDetected: false,
                confidence: 0.95,
                timestamp: new Date().toISOString()
            }
        };

        const response = await api.post(`${API_PREFIX}/report-violation`, violationData);
        console.log('✅ Violation Reported:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Violation Report Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 7: Log device with detection
 */
async function testLogDevice() {
    console.log('\n📱 Testing: Log Device with Detection');
    try {
        const deviceData = {
            deviceInfo: {
                screenResolution: '1920x1080',
                browser: 'Chrome',
                os: 'Windows 10'
            },
            page: '/exam/start',
            enableDetection: true,
            timestamp: new Date().toISOString()
        };

        const response = await api.post(`${API_PREFIX}/log-device`, deviceData, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log('✅ Device Logged:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Device Log Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 8: Exam attempt with proctoring
 */
async function testExamAttempt() {
    console.log('\n📝 Testing: Exam Attempt');
    try {
        const attemptData = {
            examId: TEST_EXAM_ID,
            userId: TEST_USER_ID,
            enableProctoring: true,
            deviceInfo: {
                screenResolution: '1920x1080',
                browser: 'Chrome'
            },
            timestamp: new Date().toISOString()
        };

        const response = await api.post(`${API_PREFIX}/exam/start-attempt`, attemptData, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log('✅ Exam Attempt:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Exam Attempt Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 9: Stop detection
 */
async function testStopDetection() {
    console.log('\n🛑 Testing: Stop Detection');
    try {
        const response = await api.post(`${API_PREFIX}/stop-detection`, {
            sessionId: 'active'
        });
        console.log('✅ Detection Stopped:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Stop Detection Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 10: Get device logs
 */
async function testGetDeviceLogs(userId) {
    console.log('\n📋 Testing: Get Device Logs');
    try {
        const response = await api.get(`${API_PREFIX}/device-logs/${userId || TEST_USER_ID}`);
        console.log('✅ Device Logs:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Device Logs Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 11: Webhook for real-time detection
 */
async function testWebhook() {
    console.log('\n🔄 Testing: Webhook Detection');
    try {
        const webhookData = {
            event: 'head_down',
            examId: TEST_EXAM_ID,
            userId: TEST_USER_ID,
            data: {
                headDown: true,
                phoneDetected: true,
                earphonesDetected: false,
                booksDetected: false,
                confidence: 0.92,
                timestamp: new Date().toISOString()
            }
        };

        const response = await api.post(`${API_PREFIX}/webhook/detection`, webhookData);
        console.log('✅ Webhook Processed:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Webhook Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 12: Get device check
 */
async function testDeviceCheck() {
    console.log('\n✅ Testing: Device Check');
    try {
        const response = await api.get(`${API_PREFIX}/device-check`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        console.log('✅ Device Check:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Device Check Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Test 13: Get proctoring report
 */
async function testGetReport(examId) {
    console.log('\n📊 Testing: Get Proctoring Report');
    try {
        const response = await api.get(`${API_PREFIX}/report/${examId || TEST_EXAM_ID}`);
        console.log('✅ Report:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Report Failed:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Run all tests
 */
async function runAllTests() {
    console.log('========================================');
    console.log('🚀 STARTING PROCTORING API TESTS');
    console.log('========================================');
    console.log(`📡 Base URL: ${BASE_URL}`);
    console.log(`📝 Exam ID: ${TEST_EXAM_ID}`);
    console.log(`👤 User ID: ${TEST_USER_ID}`);
    console.log('========================================\n');

    let sessionId = null;
    let results = {
        passed: 0,
        failed: 0,
        total: 0
    };

    // Run tests in sequence
    const tests = [
        { name: 'Device Info', fn: testGetDeviceInfo },
        { name: 'Validate Device', fn: testValidateDevice },
        { name: 'Device Check', fn: testDeviceCheck },
        { name: 'Log Device', fn: testLogDevice },
        { name: 'Start Proctoring', fn: testStartProctoring },
        { name: 'Get Detection Status', fn: testGetDetectionStatus },
        { name: 'Report Violation', fn: testReportViolation },
        { name: 'Get Suspicious Activities', fn: testGetSuspiciousActivities },
        { name: 'Get Device Logs', fn: testGetDeviceLogs },
        { name: 'Webhook', fn: testWebhook },
        { name: 'Exam Attempt', fn: testExamAttempt },
        { name: 'Stop Detection', fn: testStopDetection },
        { name: 'Get Report', fn: testGetReport }
    ];

    for (const test of tests) {
        try {
            const result = await test.fn();
            if (result) {
                results.passed++;
                if (test.name === 'Start Proctoring' && result.sessionId) {
                    sessionId = result.sessionId;
                }
            } else {
                results.failed++;
            }
        } catch (error) {
            console.error(`❌ Test "${test.name}" crashed:`, error.message);
            results.failed++;
        }
        results.total++;
    }

    // Summary
    console.log('\n========================================');
    console.log('📊 TEST SUMMARY');
    console.log('========================================');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Total: ${results.total}`);
    console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(2)}%`);
    console.log('========================================');
    console.log(`🆔 Session ID: ${sessionId || 'N/A'}`);
    console.log('========================================');
}

/**
 * Run specific test by name
 */
async function runSpecificTest(testName) {
    const testMap = {
        'device-info': testGetDeviceInfo,
        'validate-device': testValidateDevice,
        'device-check': testDeviceCheck,
        'log-device': testLogDevice,
        'start': testStartProctoring,
        'status': testGetDetectionStatus,
        'violation': testReportViolation,
        'activities': testGetSuspiciousActivities,
        'logs': testGetDeviceLogs,
        'webhook': testWebhook,
        'exam': testExamAttempt,
        'stop': testStopDetection,
        'report': testGetReport
    };

    const testFn = testMap[testName];
    if (!testFn) {
        console.log(`❌ Test "${testName}" not found. Available tests: ${Object.keys(testMap).join(', ')}`);
        return;
    }

    console.log(`\n🚀 Running test: ${testName}`);
    await testFn();
}

/**
 * Check server health
 */
async function checkServerHealth() {
    try {
        const response = await axios.get(`${BASE_URL}/api/proctoring`);
        console.log('✅ Server is healthy:', response.data.message);
        return true;
    } catch (error) {
        console.error('❌ Server health check failed:', error.message);
        return false;
    }
}

// ==========================================
// ===== MAIN EXECUTION =====
// ==========================================

// Parse command line arguments
const args = process.argv.slice(2);
const testName = args[0];
const token = args[1];

if (token) {
    process.env.TEST_TOKEN = token;
}

// Run tests based on arguments
async function main() {
    // Check server health first
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
        console.log('❌ Server is not healthy. Please start the server first.');
        process.exit(1);
    }

    if (testName) {
        await runSpecificTest(testName);
    } else {
        await runAllTests();
    }
}

// Run main function
main().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
});

// ==========================================
// ===== EXPORT FOR OTHER TESTS =====
// ==========================================

export {
    testGetDeviceInfo,
    testValidateDevice,
    testStartProctoring,
    testGetDetectionStatus,
    testGetSuspiciousActivities,
    testReportViolation,
    testLogDevice,
    testExamAttempt,
    testStopDetection,
    testGetDeviceLogs,
    testWebhook,
    testDeviceCheck,
    testGetReport,
    runAllTests,
    runSpecificTest,
    checkServerHealth
};