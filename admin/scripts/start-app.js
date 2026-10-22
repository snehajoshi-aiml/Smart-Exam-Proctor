const net = require('net');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3001;
const URL = `http://localhost:${PORT}`;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(400);
    client.once('connect', () => {
      client.destroy();
      resolve(true);
    });
    client.once('timeout', () => {
      client.destroy();
      resolve(false);
    });
    client.once('error', () => {
      client.destroy();
      resolve(false);
    });
    client.connect(port, '127.0.0.1');
  });
}

function forceOpenBrowser(url) {
  console.log(`\n🌐 Opening ${url} in default browser...\n`);
  try {
    if (process.platform === 'win32') {
      exec(`start "" "${url}"`);
    } else if (process.platform === 'darwin') {
      exec(`open "${url}"`);
    } else {
      exec(`xdg-open "${url}"`);
    }
  } catch (err) {
    console.error('Browser launch error:', err);
  }
}

async function waitForPort(port, maxAttempts = 120) {
  for (let i = 0; i < maxAttempts; i++) {
    const inUse = await isPortInUse(port);
    if (inUse) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  const inUse = await isPortInUse(PORT);

  if (inUse) {
    console.log(`✅ Admin dev server is already running at ${URL}`);
    forceOpenBrowser(URL);
    process.exit(0);
  } else {
    console.log(`🚀 Launching Admin development server on ${URL}...`);
    
    const env = { 
      ...process.env, 
      BROWSER: 'none',
      GENERATE_SOURCEMAP: 'false',
      DISABLE_ESLINT_PLUGIN: 'true',
      FAST_REFRESH: 'true'
    };

    const reactScriptsBin = path.resolve(__dirname, '../node_modules/react-scripts/bin/react-scripts.js');

    let child;
    if (fs.existsSync(reactScriptsBin)) {
      child = spawn(process.execPath, [reactScriptsBin, 'start'], {
        stdio: 'inherit',
        shell: false,
        env: env,
        cwd: path.resolve(__dirname, '..')
      });
    } else {
      child = spawn('npx', ['react-scripts', 'start'], {
        stdio: 'inherit',
        shell: true,
        env: env,
        cwd: path.resolve(__dirname, '..')
      });
    }

    let launched = false;
    waitForPort(PORT).then((ready) => {
      if (ready && !launched) {
        launched = true;
        setTimeout(() => {
          forceOpenBrowser(URL);
        }, 500);
      }
    });

    child.on('exit', (code) => {
      process.exit(code || 0);
    });
  }
}

main();
