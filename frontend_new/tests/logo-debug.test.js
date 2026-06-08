const http = require('http');
const { URL } = require('url');

class MiniWS {
  constructor(url) {
    this.url = new URL(url);
    this.socket = null;
    this.msgId = 1;
    this.pending = new Map();
    this._ready = false;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const net = require('net');
      const crypto = require('crypto');
      const key = crypto.randomBytes(16).toString('base64');
      const port = this.url.port || 9222;
      this.socket = net.createConnection(port, this.url.hostname, () => {
        const hs = [
          'GET ' + this.url.pathname + ' HTTP/1.1',
          'Host: ' + this.url.hostname + ':' + port,
          'Upgrade: websocket', 'Connection: Upgrade',
          'Sec-WebSocket-Key: ' + key, 'Sec-WebSocket-Version: 13',
          '', ''
        ].join('\r\n');
        this.socket.write(hs);
      });
      this.socket.on('data', (raw) => {
        if (!this._ready) {
          const s = raw.toString('binary');
          if (s.indexOf('101') === -1) return;
          this._ready = true;
          const idx = s.indexOf('\r\n\r\n');
          if (idx !== -1 && idx + 4 < s.length) {
            this._frame(Buffer.from(s.slice(idx + 4), 'binary'));
          }
          resolve();
          return;
        }
        this._frame(Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'binary'));
      });
      this.socket.on('error', reject);
      this.socket.setTimeout(10000, () => { this.socket.destroy(); reject(new Error('WS timeout')); });
    });
  }
  _frame(buf) {
    if (buf.length < 2) return;
    const op = buf[0] & 0x0f;
    if (op === 0x8) { this.close(); return; }
    if (op !== 0x1) return;
    let len = buf[1] & 0x7f, off = 2;
    if (len === 126) { len = buf.readUInt16BE(2); off = 4; }
    else if (len === 127) { len = Number(buf.readBigUInt64BE(2)); off = 10; }
    const masked = (buf[1] & 0x80) !== 0;
    let payload;
    if (masked) {
      const mask = buf.slice(off, off + 4); off += 4;
      payload = buf.slice(off, off + len);
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    } else {
      payload = buf.slice(off, off + len);
    }
    try {
      const msg = JSON.parse(payload.toString('utf8'));
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)(msg);
        this.pending.delete(msg.id);
      }
    } catch (e) {}
  }
  _send(obj) {
    const buf = Buffer.from(JSON.stringify(obj), 'utf8');
    const hdr = Buffer.allocUnsafe(2 + (buf.length < 126 ? 0 : buf.length < 65536 ? 2 : 8));
    hdr[0] = 0x81; let o = 2;
    if (buf.length < 126) { hdr[1] = buf.length; }
    else if (buf.length < 65536) { hdr[1] = 126; hdr.writeUInt16BE(buf.length, 2); o = 4; }
    else { hdr[1] = 127; hdr.writeBigUInt64BE(BigInt(buf.length), 2); o = 10; }
    this.socket.write(Buffer.concat([hdr.slice(0, o), buf]));
  }
  send(method, params) {
    params = params || {};
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, resolve);
      this._send({ id, method, params });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Timeout: ' + method));
        }
      }, 15000);
    });
  }
  evaluate(expr) {
    return this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false })
      .then(res => {
        if (res.result && res.result.exceptionDetails) throw new Error(res.result.exceptionDetails.text || 'JS error');
        return res.result.result.value;
      });
  }
  close() { try { this.socket.write(Buffer.from([0x88, 0x00])); } catch(e) {} if (this.socket) this.socket.destroy(); }
}

function httpGetJSON(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('HTTP timeout')); });
  });
}

async function main() {
  const targets = await httpGetJSON('http://localhost:9222/json');
  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl && !t.url.startsWith('devtools://') && !t.url.startsWith('chrome://'));
  console.log('Target:', page.url);

  const ws = new MiniWS(page.webSocketDebuggerUrl);
  await ws.connect();

  // Check current URL
  const urlResult = await ws.evaluate('window.location.href');
  console.log('Current URL:', urlResult);

  // Check for all images
  const imgCheck = await ws.evaluate(
    '(function(){var imgs=document.querySelectorAll("img");var results=[];for(var i=0;i<imgs.length;i++){results.push({src:imgs[i].src,alt:imgs[i].alt,complete:imgs[i].complete,naturalWidth:imgs[i].naturalWidth});}return JSON.stringify({total:imgs.length,imgs:results})})()'
  );
  console.log('Images:', imgCheck);

  // Check for logo specifically
  const logoCheck = await ws.evaluate(
    '(function(){var imgs=document.querySelectorAll("img");for(var i=0;i<imgs.length;i++){if(imgs[i].src.indexOf("logo-cloudfly")!==-1){var r=imgs[i].getBoundingClientRect();return JSON.stringify({found:true,src:imgs[i].src,alt:imgs[i].alt,w:imgs[i].width,h:imgs[i].height,nw:imgs[i].naturalWidth,nh:imgs[i].naturalHeight,complete:imgs[i].complete,rect:{top:Math.round(r.top),left:Math.round(r.left),width:Math.round(r.width),height:Math.round(r.height)}})}}return JSON.stringify({found:false})})()'
  );
  console.log('Logo:', logoCheck);

  ws.close();
}

main().catch(err => console.error('Error:', err.message));
