// Capture network + console for a URL using the DSH-registered @playwright/mcp
const { spawn } = require('child_process');

const URL = process.argv[2] || 'http://15.188.51.33/delivery';

const child = spawn(
  process.env.HOME + '/.nvm/versions/node/v22.23.2/bin/npx',
  ['-y', '@playwright/mcp@0.0.79', '--browser', 'chrome'],
  { env: { ...process.env, npm_config_cache: process.env.HOME + '/.cache/dsh-mcp-npm' }, stdio: ['pipe', 'pipe', 'pipe'] }
);

let buf = '';
const pending = {};
let idc = 0;

function send(method, params, timeoutMs = 60000) {
  const id = ++idc;
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((res, rej) => {
    pending[id] = { res, rej };
    setTimeout(() => rej(new Error('timeout: ' + method)), timeoutMs);
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
child.stderr.on('data', () => {});

const textOf = r => (r.result?.content || []).map(c => c.text || '').join('\n');

(async () => {
  await send('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'dsh-capture', version: '1.0' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  console.log('>>> NAVIGATE: ' + URL);
  const nav = await send('tools/call', { name: 'browser_navigate', arguments: { url: URL } }, 90000);
  console.log('NAVIGATE ok:', !nav.result.isError, nav.result.isError ? textOf(nav) : '');

  // let page settle (XHR/fetch, dynamic scripts)
  await new Promise(r => setTimeout(r, 6000));

  console.log('\n========== NETWORK REQUESTS (network 数据流, static:true) ==========');
  const net = await send('tools/call', { name: 'browser_network_requests', arguments: { static: true } }, 60000);
  const netText = textOf(net);
  console.log(netText);

  // find requests with error statuses for detail fetch
  const errIdx = [];
  const re = /^(\d+)\.\s+\S+\s+-\s+(\d{3})/gm;
  let mm;
  while ((mm = re.exec(netText))) {
    const status = +mm[2];
    if (status >= 400) errIdx.push(+mm[1]);
  }

  console.log('\n========== CONSOLE MESSAGES (控制台信息) ==========');
  const con = await send('tools/call', { name: 'browser_console_messages', arguments: { level: 'info', all: true } }, 60000);
  console.log(textOf(con));

  const detailIdx = [...new Set([1, ...errIdx])].slice(0, 6);
  for (const idx of detailIdx) {
    console.log(`\n========== REQUEST DETAIL #${idx} ==========`);
    try {
      const det = await send('tools/call', { name: 'browser_network_request', arguments: { index: idx } }, 45000);
      const t = textOf(det);
      console.log(t.length > 4000 ? t.slice(0, 4000) + '\n...[truncated]' : t);
    } catch (e) { console.log('detail fetch failed:', e.message); }
  }

  process.exit(0);
})().catch(e => { console.error('CAPTURE FAIL:', e.message); process.exit(1); });

setTimeout(() => { console.error('GLOBAL TIMEOUT'); process.exit(2); }, 180000);
