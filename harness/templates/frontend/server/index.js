import { createServer } from 'node:http';

const port = Number(process.env.PORT || 3000);
createServer((request, response) => {
  if (request.url === '/api/health') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ ok: true })); return; }
  response.writeHead(404, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'not_found' }));
}).listen(port, () => console.log(`API server listening on :${port}`));
