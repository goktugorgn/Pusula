
const { spawn } = require('child_process');

console.log('--- Diagnosis: Execution Test ---');
console.log('User ID:', process.getuid());
console.log('Groups:', process.getgroups());

function run(label, cmd, args) {
  return new Promise((resolve) => {
    console.log(`\n[${label}] Running: ${cmd} ${args.join(' ')}`);
    const child = spawn(cmd, args, { stdio: 'pipe' });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    
    child.on('close', (code) => {
      console.log(`[${label}] Exit Code: ${code}`);
      if (stdout) console.log(`[${label}] STDOUT:\n${stdout.trim()}`);
      if (stderr) console.log(`[${label}] STDERR:\n${stderr.trim()}`);
      resolve();
    });
    
    child.on('error', (err) => {
      console.log(`[${label}] ERROR: ${err.message}`);
      resolve();
    });
  });
}

async function main() {
  // Test 1: Simple sudo check
  await run('SUDO_CHECK', 'sudo', ['-n', 'id']);
  
  // Test 2: Unbound status (Absolute path)
  await run('UNBOUND_ABS', 'sudo', ['-n', '/usr/sbin/unbound-control', 'status']);
  
  // Test 3: Unbound stats
  await run('UNBOUND_STATS', 'sudo', ['-n', '/usr/sbin/unbound-control', 'stats_noreset']);
}

main();
