import { exec, spawn } from 'child_process';
import util from 'util';
import net from 'net';
import fs from 'fs';
import path from 'path';
import url from 'url';

// ES Module dirname polyfill
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const frontendDir = path.resolve(backendDir, '../hyperlocal-frontend');

const execPromise = util.promisify(exec);

async function run() {
  // Dynamically import ES modules
  const chalk = (await import('chalk')).default;
  const ora = (await import('ora')).default;
  const open = (await import('open')).default;
  const dotenv = (await import('dotenv')).default;

  console.log('\n' + chalk.bold.magenta('🚀 HyperLocal Go Master Startup') + '\n');

  // STEP A: Environment Validation
  const envSpinner = ora('Validating environment...').start();
  dotenv.config({ path: path.join(backendDir, '.env') });

  if (!process.env.DATABASE_URL) {
    envSpinner.fail(chalk.red('DATABASE_URL missing in .env'));
    process.exit(1);
  }
  
  const backendPort = process.env.PORT || 5001;
  const frontendPort = 3000;
  envSpinner.succeed(chalk.green('Environment Loaded'));

  // STEP B: Database Safety Check
  const dbSpinner = ora('Syncing Prisma schema...').start();
  try {
    await execPromise('npx prisma db push', { cwd: backendDir });
    dbSpinner.succeed(chalk.green('Database Connected & Schema Synced'));
  } catch (error) {
    dbSpinner.fail(chalk.red('Failed to sync Prisma schema'));
    if (process.env.NODE_ENV === 'development') {
      console.error(chalk.dim(error.message));
    }
    process.exit(1);
  }

  // STEP C: Auto Seed Development Data
  const seedSpinner = ora('Seeding development data...').start();
  try {
    await execPromise('node prisma/seed.js', { cwd: backendDir });
    seedSpinner.succeed(chalk.green('Seed Data Ready'));
  } catch (error) {
    seedSpinner.fail(chalk.red('Failed to seed database'));
    if (process.env.NODE_ENV === 'development') {
      console.error(chalk.dim(error.message));
    }
    process.exit(1);
  }

  // STEP D: Start Backend & Frontend
  const bootSpinner = ora('Starting dual-boot engines (Backend & Frontend)...').start();
  
  // Start Backend
  const backendProcess = spawn('npm', ['run', 'dev'], { 
    cwd: backendDir,
    stdio: 'ignore',
    detached: true,
    shell: true,
    env: { ...process.env, PORT: backendPort }
  });

  // Check if frontend directory exists
  if (!fs.existsSync(frontendDir)) {
    bootSpinner.fail(chalk.red(`Frontend directory not found at: ${frontendDir}`));
    process.exit(1);
  }

  // Start Frontend
  const out = fs.openSync(path.join(backendDir, 'frontend.log'), 'a');
  const err = fs.openSync(path.join(backendDir, 'frontend.err'), 'a');
  const frontendProcess = spawn('npm', ['run', 'dev'], { 
    cwd: frontendDir,
    stdio: ['ignore', out, err],
    detached: true,
    shell: true,
    env: { ...process.env, PORT: frontendPort }
  });

  // Function to poll a specific port
  const checkPort = (port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(200);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, '127.0.0.1');
    });
  };

  let backendReady = false;
  let frontendReady = false;
  let attempts = 0;
  const maxAttempts = 60; // 60 * 500ms = 30 seconds timeout for frontend compilation

  while ((!backendReady || !frontendReady) && attempts < maxAttempts) {
    attempts++;
    if (!backendReady) backendReady = await checkPort(backendPort);
    if (!frontendReady) frontendReady = await checkPort(frontendPort);
    
    if (!backendReady || !frontendReady) {
      await new Promise(res => setTimeout(res, 500));
    }
  }

  if (!backendReady || !frontendReady) {
    bootSpinner.fail(chalk.red(`Timeout: Backend(${backendReady}) on ${backendPort}, Frontend(${frontendReady}) on ${frontendPort}`));
    process.exit(1);
  }

  bootSpinner.succeed(chalk.green(`Servers Running [Backend: ${backendPort} | Frontend: ${frontendPort}]`));

  // STEP E: Premium Terminal UX
  const browserSpinner = ora('Opening Browser...').start();
  try {
    await open(`http://localhost:${frontendPort}`);
    browserSpinner.succeed(chalk.green('Browser Opened'));
    console.log('\n' + chalk.bold.cyan('✨ HyperLocal Go is ready for development!') + '\n');
    console.log(chalk.dim('Note: Servers are running in the background. Press Ctrl+C in this terminal to kill BOTH servers cleanly.'));
    
    // Graceful cleanup
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\nShutting down both servers...'));
      try {
        process.kill(-backendProcess.pid);
        process.kill(-frontendProcess.pid);
      } catch (e) {
        // Ignore dead processes
      }
      process.exit(0);
    });
    
    // Keep the Node.js event loop alive indefinitely so it can listen for SIGINT
    setInterval(() => {}, 1000 * 60 * 60);

  } catch (error) {
    browserSpinner.fail(chalk.red('Failed to open browser automatically.'));
    console.log(chalk.cyan(`Please navigate manually to http://localhost:${frontendPort}`));
  }
}

run();
