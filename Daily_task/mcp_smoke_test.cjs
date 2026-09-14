// Smoke test: verify @playwright/mcp works with the exact DSH config command
const { spawn } = require('child_process');

const child = spawn(
  '/Users/user/.nvm/versions/node/v22.23.2/bin/npx',
  ['-y', '@playwright/mcp@0.0.79', '--browser', 'chrome'],
  { env: { ...process.env, npm_config_cache: '/tmp/dsh-npm-cache-501' }, stdio: ['pipe', 'pipe', 'pipe'] }
);

let buf = '';
const pending = {};
let idc = 0;

function send(method, params) {
  const id = ++idc;
  const msg = { jsonrpc: '2.0', id, method, params };
  child.stdin.write(JSON.stringify(msg) + '\n');
  return new Promise((res, rej) => {
    pending[id] = { res, rej };
    setTimeout(() => rej(new Error('timeout: ' + method)), 20000);
  });
}

child.stdout.on('data', d => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.id && pending[m.id]) { pending[m.id].res(m); delete pending[m.id]; }
  }
});

child.stderr.on('data', d => { process.stderr.write('[mcp-stderr] ' + d.toString().slice(0, 300)); });

(async () => {
  const init = await send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'dsh-smoke', version: '1.0' }
  });
  console.log('INIT OK, server:', JSON.stringify(init.result && init.result.serverInfo));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const tools = await send('tools/list', {});
  const names = (tools.result.tools || []).map(t => t.name);
  console.log('TOOLS TOTAL:', names.length);
  console.log('NETWORK/CONSOLE TOOLS:', names.filter(n => /network|console/i.test(n)).join(', '));

  console.log('>> opening Chrome (headed) and navigating to https://example.com ...');
  const nav = await send('tools/call', { name: 'browser_navigate', arguments: { url: 'https://example.com' } });
  console.log('NAVIGATE ok:', !nav.result.isError, nav.result.isError ? JSON.stringify(nav.result).slice(0, 400) : '');

  await new Promise(r => setTimeout(r, 3000));

  const net = await send('tools/call', { name: 'browser_network_requests', arguments: {} });
  console.log('NETWORK REQUESTS (network 数据流):');
  console.log(JSON.stringify(net.result).slice(0, 1500));

  const con = await send('tools/call', { name: 'browser_console_messages', arguments: { filter: '' } });
  console.log('CONSOLE MESSAGES (控制台信息):');
  console.log(JSON.stringify(con.result).slice(0, 800));

  process.exit(0);
})().catch(e => { console.error('SMOKE FAIL:', e.message); process.exit(1); });

setTimeout(() => { console.error('GLOBAL TIMEOUT'); process.exit(2); }, 120000);
