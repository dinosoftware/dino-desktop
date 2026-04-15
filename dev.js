const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const FRONTEND_DIR = path.join(__dirname, 'frontend');

function waitFor(url) {
  return new Promise((resolve) => {
    const check = () => {
      http.get(url, (res) => { res.statusCode === 200 ? resolve() : setTimeout(check, 500); }).on('error', () => setTimeout(check, 500));
    };
    check();
  });
}

const vite = spawn('npm', ['run', 'dev'], { cwd: FRONTEND_DIR, stdio: 'inherit', shell: true });

async function launch() {
  await waitFor('http://localhost:5173');
  console.log('\nStarting Electron...');
  const env = { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' };
  const electronBin = require('electron');
  const mainJs = path.join(__dirname, 'main.js');
  const electronProc = spawn(electronBin, [mainJs], { env, stdio: 'inherit', shell: true });
  electronProc.on('close', () => { vite.kill(); process.exit(0); });
}

launch().catch((err) => { console.error(err); vite.kill(); process.exit(1); });
