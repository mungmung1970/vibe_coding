import { createServer } from 'node:http';
const port = Number(process.env.PORT ?? 3000);
createServer((request, response) => { response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ ok: true, path: request.url, message: 'Replace this placeholder with the project API.' })); }).listen(port, () => console.log(`API placeholder listening on :${port}`));
