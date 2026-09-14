// netmon.cjs — 用系统 Chrome (headless) + CDP 打开目标网址，监听前 LISTEN_MS 毫秒的所有网络请求
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const TARGET_URL = process.env.TARGET_URL || 'http://15.188.51.33/';
const LISTEN_MS = parseInt(process.env.LISTEN_MS || '10000', 10);
const DEBUG_PORT = 9222;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const USER_DATA_DIR = `/tmp/chrome-dsh-${process.pid}`;
const REPORT = process.env.REPORT_FILE || '/tmp/netmon_report.txt';

const lines = [];
function log(s) { lines.push(s); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function waitForEndpoint(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const list = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (Array.isArray(list) && list.length) return list;
    } catch (_) { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('Chrome debugging endpoint did not come up');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.onopen = () => {
      const send = (method, params = {}) => new Promise((res, rej) => {
        const msgId = ++id;
        pending.set(msgId, { res, rej });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
      resolve({
        ws,
        send,
        on(method, fn) {
          if (!listeners.has(method)) listeners.set(method, []);
          listeners.get(method).push(fn);
        }
      });
    };
    ws.onerror = e => reject(new Error('WS error: ' + (e.message || 'unknown')));
    ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
      } else if (msg.method) {
        (listeners.get(msg.method) || []).forEach(fn => { try { fn(msg.params); } catch (e) { log('listener error: ' + e.message); } });
      }
    };
    ws.onclose = ev => {
      log(`[WS 关闭] code=${ev.code} reason=${ev.reason}`);
      pending.forEach(p => p.rej(new Error('WS closed')));
    };
  });
}

(async () => {
  const chromeStderr = [];
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA_DIR}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--disable-background-networking', '--disable-extensions',
    '--no-sandbox', '--disable-crash-reporter', '--disable-breakpad',
    '--disable-dev-shm-usage', '--no-zygote',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  chrome.stderr.on('data', d => { chromeStderr.push(d.toString()); if (chromeStderr.length > 200) chromeStderr.shift(); });
  chrome.on('exit', (code, sig) => log(`[chrome 退出] code=${code} sig=${sig}`));

  let ws = null;
  try {
    const pages = await waitForEndpoint(15000);
    const page = pages.find(p => p.type === 'page') || pages[0];
    log(`[调试] 选择 target: ${page.id} url=${page.url}`);
    ws = await connect(page.webSocketDebuggerUrl);
    log('[调试] WebSocket 已连接');
    const { send, on } = ws;

    await send('Network.enable');
    await send('Page.enable');
    await send('Runtime.enable');
    log('[调试] CDP 域已启用');

    // 注入 fetch/XHR 拦截器，捕获所有 JS 发起的网络调用
    const INTERCEPT = `
      (function(){
        if (window.__netmonInstalled__) return;
        window.__netmonInstalled__ = true;
        window.__netmonLog__ = [];
        function rec(kind, method, url, body) {
          try { window.__netmonLog__.push({t: Date.now(), kind: kind, method: method, url: String(url).slice(0, 1000), body: body ? String(body).slice(0, 500) : null}); } catch(e){}
        }
        const origFetch = window.fetch;
        window.fetch = function(input, init) {
          const url = typeof input === 'string' ? input : (input && input.url) || String(input);
          const method = (init && init.method) || (input && input.method) || 'GET';
          rec('fetch', method, url, init && init.body);
          return origFetch.apply(this, arguments).then(r => {
            try { window.__netmonLog__.push({t: Date.now(), kind: 'fetch-resp', status: r.status, url: String(url).slice(0, 1000)}); } catch(e){}
            return r;
          });
        };
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function(method, url) {
          this.__nm = {method: method, url: String(url)};
          return origOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function(body) {
          if (this.__nm) rec('xhr', this.__nm.method, this.__nm.url, body);
          this.addEventListener('loadend', function(){
            try { window.__netmonLog__.push({t: Date.now(), kind: 'xhr-resp', status: this.status, url: this.__nm ? this.__nm.url : ''}); } catch(e){}
          });
          return origSend.apply(this, arguments);
        };
        console.log('[netmon] fetch/XHR 拦截器已注入');
      })();
    `;
    await send('Page.addScriptToEvaluateOnNewDocument', { source: INTERCEPT });
    await send('Runtime.evaluate', { expression: INTERCEPT });
    log('[调试] 拦截器已注入');

    on('Runtime.consoleAPICalled', p => {
      const txt = (p.args || []).map(a => a.value !== undefined ? String(a.value) : (a.description || '')).join(' ');
      if (txt) log(`[console.${p.type}] ${txt.slice(0, 500)}`);
    });
    on('Runtime.exceptionThrown', p => {
      log(`[页面异常] ${(p.exceptionDetails && p.exceptionDetails.text) || ''} ${(p.exceptionDetails && p.exceptionDetails.exception && p.exceptionDetails.exception.description) || ''}`.slice(0, 600));
    });

    const requests = new Map();
    const fetchXhr = [];

    on('Network.requestWillBeSent', p => {
      const { requestId, request, type, initiator } = p;
      requests.set(requestId, {
        id: requestId, url: request.url, method: request.method,
        type, initiatorType: initiator && initiator.type,
        status: null, mimeType: null, dataLength: null, ts: p.timestamp
      });
    });
    on('Network.responseReceived', p => {
      const r = requests.get(p.requestId);
      if (r) { r.status = p.response.status; r.mimeType = p.response.mimeType; }
    });
    on('Network.loadingFinished', p => {
      const r = requests.get(p.requestId);
      if (r) r.dataLength = p.encodedDataLength;
    });

    const t0 = Date.now();
    log(`[${new Date().toISOString()}] 导航到 ${TARGET_URL}`);
    await send('Page.navigate', { url: TARGET_URL });

    while (Date.now() - t0 < LISTEN_MS) await sleep(200);

    const fxs = [...requests.values()].filter(r =>
      (r.type === 'Fetch' || r.type === 'XHR' || r.initiatorType === 'fetch' || r.initiatorType === 'xhr') &&
      !r.url.startsWith('data:')
    );
    log('');
    log(`========== 监听 ${LISTEN_MS / 1000}s 结束 ==========`);
    log(`总请求数: ${requests.size}  |  fetch/XHR 请求数: ${fxs.length}`);
    log('');

    for (const r of fxs) {
      let body = '';
      try {
        const res = await send('Network.getResponseBody', { requestId: r.id });
        body = res && res.body ? (res.body.length > 2000 ? res.body.slice(0, 2000) + `…[截断, 共${res.body.length}字符]` : res.body) : '(空)';
      } catch (_) { body = '(无法获取响应体)'; }
      log(`--- ${r.method} ${r.url}`);
      log(`    type=${r.type} status=${r.status} mime=${r.mimeType} bytes=${r.dataLength}`);
      log(`    响应体: ${body}`);
      log('');
    }

    log('===== 所有请求清单 (按时间) =====');
    [...requests.values()].sort((a, b) => a.ts - b.ts).forEach(r => {
      log(`[${r.type || r.initiatorType}] ${r.method} ${r.status || '-'} ${r.url}`);
    });

    // 8. 读取页面内拦截器日志（兜底确认 fetch/XHR 活动）
    try {
      const res = await send('Runtime.evaluate', {
        expression: 'JSON.stringify(window.__netmonLog__ || [])',
        returnByValue: true
      });
      const interceptorLog = JSON.parse(res.result.value || '[]');
      log('');
      log('===== 页面内 fetch/XHR 拦截器日志 =====');
      if (interceptorLog.length === 0) log('(无任何 fetch/XHR 调用)');
      interceptorLog.forEach(e => log(`[${new Date(e.t).toISOString()}] ${e.kind} ${e.method || ''} ${e.url}${e.status !== undefined ? ' status=' + e.status : ''}${e.body ? ' body=' + e.body : ''}`));
    } catch (e) {
      log('读取拦截器日志失败: ' + e.message);
    }

    fs.writeFileSync(REPORT, lines.join('\n') + '\n');
    if (chromeStderr.length) fs.appendFileSync(REPORT, '\n===== Chrome stderr =====\n' + chromeStderr.join('').slice(0, 3000) + '\n');
  } catch (e) {
    fs.writeFileSync(REPORT, lines.join('\n') + '\n脚本失败: ' + e.stack + '\n');
    if (chromeStderr.length) fs.appendFileSync(REPORT, '\n===== Chrome stderr =====\n' + chromeStderr.join('').slice(0, 3000) + '\n');
  } finally {
    if (ws) { try { ws.ws.close(); } catch (_) {} }
    chrome.kill('SIGKILL');
    try { fs.rmSync(USER_DATA_DIR, { recursive: true, force: true }); } catch (_) {}
  }
})();
