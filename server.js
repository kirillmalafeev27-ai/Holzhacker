import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

const roots = [
  { prefix: '/vendor/', dir: path.join(__dirname, 'node_modules') },
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

const server = http.createServer((req, res) => {
  let filePath = resolveRequest(req.url || '/');
  if (!filePath) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
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
    res.writeHead(200, {
      'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Forest Defense running at http://${HOST}:${PORT}`);
});
