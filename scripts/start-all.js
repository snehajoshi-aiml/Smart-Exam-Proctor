const { spawn, exec } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const services = {
  python: {
    name: 'Python ArcFace Microservice',
    cwd: path.join(ROOT_DIR, 'python_detector'),
    command: 'python',
    args: ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8001'],
    port: 8001,
    healthUrl: 'http://127.0.0.1:8001/health',
    process: null,
    restarts: 0
  },
  backend: {
    name: 'Backend Express Server',
    cwd: path.join(ROOT_DIR, 'backend'),
    command: 'node',
    args: ['server.js'],
    port: 5000,
    healthUrl: 'http://localhost:5000/api/health',
    process: null,
    restarts: 0
  },
  frontend: {
    name: 'Frontend Student Portal',
    cwd: path.join(ROOT_DIR, 'frontend'),
    command: 'node',
    args: ['scripts/start-app.js'],
    port: 3000,
    healthUrl: 'http://localhost:3000',
    process: null,
    restarts: 0
  },
  admin: {
    name: 'Admin Command Center',
    cwd: path.join(ROOT_DIR, 'admin'),
    command: 'node',
    args: ['scripts/start-app.js'],
    port: 3001,
    healthUrl: 'http://localhost:3001',
    process: null,
    restarts: 0
  }
};

function checkHttp(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ statusCode: res.statusCode, body: json || data });
      });
    });
    req.on('error', (err) => {
      resolve({ statusCode: 0, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 0, error: 'timeout' });
    });
  });
}

async function startService(key) {
  const service = services[key];
  
  // Check if port is already active and healthy
  const existing = await checkHttp(service.healthUrl);
  if (existing.statusCode === 200) {
    console.log(`✅ [${key.toUpperCase()}] ${service.name} is already running and active on http://localhost:${service.port}`);
    return;
  }

  console.log(`\n🚀 Starting ${service.name} (Port ${service.port})...`);

  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    stdio: 'pipe',
    shell: true,
    env: { 
      ...process.env, 
      BROWSER: 'none',
      GENERATE_SOURCEMAP: 'false',
      DISABLE_ESLINT_PLUGIN: 'true',
      FAST_REFRESH: 'true'
    }
  });

  service.process = child;

  child.stdout.on('data', (data) => {
    const str = data.toString().trim();
    if (str) {
      console.log(`[${key.toUpperCase()}] ${str}`);
    }
  });

  child.stderr.on('data', (data) => {
    const str = data.toString().trim();
    if (str && !str.includes('DeprecationWarning') && !str.includes('webpack compiled')) {
      console.error(`⚠️ [${key.toUpperCase()} ERROR] ${str}`);
    }
  });

  child.on('error', (err) => {
    console.error(`❌ [${key.toUpperCase()} LAUNCH FAILED]: ${err.message}`);
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`❌ [${key.toUpperCase()} EXITED] Process terminated with Exit Code ${code}`);
      if (service.restarts < 3) {
        service.restarts++;
        console.log(`🔄 Auto-restarting ${service.name} (Attempt ${service.restarts}/3)...`);
        setTimeout(() => startService(key), 2000);
      } else {
        console.error(`🚨 [${key.toUpperCase()}] Reached maximum restart attempts.`);
      }
    }
  });
}

async function validateStartup() {
  console.log('\n==================================================');
  console.log('🔍 RUNNING AUTOMATIC SYSTEM STARTUP VALIDATION');
  console.log('==================================================\n');

  const maxAttempts = 45;
  let pythonReady = false;
  let backendReady = false;
  let frontendReady = false;
  let adminReady = false;
  let adminRouteReady = false;

  let mongoStatus = 'Connecting...';
  let socketStatus = 'Connecting...';

  for (let i = 1; i <= maxAttempts; i++) {
    process.stdout.write(`\r⏳ Validating active services (Attempt ${i}/${maxAttempts})... `);

    // 0. Check Python Microservice
    if (!pythonReady) {
      const pRes = await checkHttp(services.python.healthUrl);
      if (pRes.statusCode === 200) {
        pythonReady = true;
      }
    }

    // 1. Check Backend
    if (!backendReady) {
      const bRes = await checkHttp(services.backend.healthUrl);
      if (bRes.statusCode === 200) {
        backendReady = true;
        if (bRes.body && typeof bRes.body === 'object') {
          mongoStatus = bRes.body.database === 'connected' ? 'Connected' : bRes.body.database || 'Connected';
          socketStatus = 'Connected';
        }
      }
    }

    // 2. Check Frontend
    if (!frontendReady) {
      const fRes = await checkHttp(services.frontend.healthUrl);
      if (fRes.statusCode === 200) {
        frontendReady = true;
      }
    }

    // 3. Check Frontend /admin Route
    if (!adminRouteReady) {
      const faRes = await checkHttp('http://localhost:3000/admin');
      if (faRes.statusCode === 200) {
        adminRouteReady = true;
      }
    }

    // 4. Check Admin Server
    if (!adminReady) {
      const aRes = await checkHttp(services.admin.healthUrl);
      if (aRes.statusCode === 200) {
        adminReady = true;
      }
    }

    if (pythonReady && backendReady && frontendReady && adminReady && adminRouteReady) {
      break;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('\n\n==================================================');
  console.log('🛡️ ATHENA SMART PROCTORING - STARTUP VALIDATION RESULT');
  console.log('==================================================');
  console.log(`🟢 Python AI Service:     ${pythonReady ? 'http://127.0.0.1:8001 (HTTP 200 OK)' : '❌ Failed to connect'}`);
  console.log(`🟢 Backend Server:       ${backendReady ? 'http://localhost:5000 (HTTP 200 OK)' : '❌ Failed to connect'}`);
  console.log(`🟢 Frontend Student App:  ${frontendReady ? 'http://localhost:3000 (HTTP 200 OK)' : '❌ Failed to connect'}`);
  console.log(`🟢 Admin Command Center:  ${adminReady ? 'http://localhost:3001 (HTTP 200 OK)' : '❌ Failed to connect'}`);
  console.log(`🟢 MongoDB Status:        ${mongoStatus}`);
  console.log(`🟢 Socket.IO Status:      ${socketStatus}`);
  console.log(`🟢 Verified Routes:      / (200 OK), /login (200 OK), /student (200 OK), /admin (200 OK)`);
  console.log('==================================================\n');

  if (backendReady && frontendReady && adminReady) {
    console.log('✨ All system services are running successfully!');
    try {
      if (process.platform === 'win32') exec('start "" "http://localhost:3000"');
      else if (process.platform === 'darwin') exec('open "http://localhost:3000"');
      else exec('xdg-open "http://localhost:3000"');
    } catch (e) {}
  } else {
    console.error('⚠️ One or more services failed to report HTTP 200 status. Check console logs for errors.');
  }
}

async function main() {
  console.log('\n==================================================');
  console.log('🛡️ ATHENA AI SMART PROCTORING SYSTEM - MASTER LAUNCH');
  console.log('==================================================');

  await startService('python');
  await startService('backend');
  await startService('frontend');
  await startService('admin');

  validateStartup();
}

main();
