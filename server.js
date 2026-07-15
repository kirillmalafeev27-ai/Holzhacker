import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { installQuizRoutes } = require('./see-escape-claude-practical-gates-bDFmc/quiz-generation.cjs');
const { installRecallRoutes } = require('./recall-evaluation.cjs');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const JSON_LIMIT = 1024 * 1024;

const roots = [
  { prefix: '/vendor/', dir: path.join(__dirname, 'node_modules') },
  { prefix: '/see-escape/', dir: path.join(__dirname, 'see-escape-claude-practical-gates-bDFmc', 'public') },
  { prefix: '/', dir: path.join(__dirname, 'public') },
];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
};

function resolveRequest(urlPath) {
  const cleanUrl = decodeURIComponent(urlPath.split('?')[0]);
  for (const root of roots) {
    if (!cleanUrl.startsWith(root.prefix)) continue;
    const relative = cleanUrl.slice(root.prefix.length) || 'index.html';
    const resolved = path.resolve(root.dir, relative);
    const rootPath = path.resolve(root.dir);
    if (resolved !== rootPath && !resolved.startsWith(`${rootPath}${path.sep}`)) return null;
    return resolved;
  }
  return null;
}

function send(res, status, body, headers = {}) {
  if (res.writableEnded) return;
  res.writeHead(status, headers);
  res.end(body);
}

function decorateResponse(res) {
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (body) => {
    const payload = JSON.stringify(body);
    send(res, res.statusCode || 200, payload, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(payload),
      'Cache-Control': 'no-cache',
    });
  };
  res.send = (body) => {
    if (Buffer.isBuffer(body)) {
      if (!res.getHeader('Content-Length')) res.setHeader('Content-Length', body.length);
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/octet-stream');
      send(res, res.statusCode || 200, body, Object.fromEntries(res.getHeaders()));
      return;
    }
    const payload = String(body ?? '');
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(payload));
    send(res, res.statusCode || 200, payload, Object.fromEntries(res.getHeaders()));
  };
}

function createRouteApp() {
  const routes = [];
  return {
    routes,
    get(routePath, handler) { routes.push({ method: 'GET', routePath, handler }); },
    post(routePath, handler) { routes.push({ method: 'POST', routePath, handler }); },
  };
}

const routeApp = createRouteApp();
installQuizRoutes(routeApp);
installRecallRoutes(routeApp);

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > JSON_LIMIT) {
        reject(Object.assign(new Error('request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw.trim()) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (error) { reject(Object.assign(error, { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

async function dispatchRoute(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const route = routeApp.routes.find((candidate) => candidate.method === req.method && candidate.routePath === url.pathname);
  if (!route) return false;
  decorateResponse(res);
  req.query = Object.fromEntries(url.searchParams.entries());
  req.body = req.method === 'POST' ? await readJsonBody(req) : {};
  try {
    await route.handler(req, res);
  } catch (error) {
    console.error('API route failed:', error);
    if (!res.writableEnded) res.status(error.statusCode || 500).json({ error: error.message || 'Internal server error' });
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    if (await dispatchRoute(req, res)) return;
  } catch (error) {
    send(res, error.statusCode || 500, JSON.stringify({ error: error.message || 'Bad request' }), {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    return;
  }
  let filePath = resolveRequest(req.url || '/');
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  const contentPath = filePath;
  let contentEncoding = '';
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (/\bbr\b/.test(acceptEncoding) && fs.existsSync(`${filePath}.br`)) {
    filePath = `${filePath}.br`;
    contentEncoding = 'br';
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Server error');
      }
      return;
    }
    const headers = {
      'Content-Type': mime[path.extname(contentPath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, max-age=0',
      'Vary': 'Accept-Encoding',
    };
    if (contentEncoding) headers['Content-Encoding'] = contentEncoding;
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Forest Defense running at http://${HOST}:${PORT}`);
});
