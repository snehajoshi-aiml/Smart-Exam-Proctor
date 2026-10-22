const { execSync } = require('child_process');

const PORT = process.env.PORT || 3001;

console.log(`\n🔍 Checking if port ${PORT} is in use...`);

try {
  if (process.platform === 'win32') {
    const cmd = `powershell -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`;
    execSync(cmd, { stdio: 'ignore' });
  } else {
    execSync(`npx -y kill-port ${PORT}`, { stdio: 'ignore' });
  }
  console.log(`🧹 Port ${PORT} cleared successfully. Launching Admin App on http://localhost:${PORT}...\n`);
} catch (err) {
  console.log(`✅ Port ${PORT} is ready.\n`);
}
