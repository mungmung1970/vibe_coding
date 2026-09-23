import { cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const sourceRoot = 'src/data/knowledge-graph';
const runtimeRoot = 'public/data/knowledge-graph';
const manifest = JSON.parse(await readFile(join(sourceRoot, 'manifest.json'), 'utf8'));
const files = ['manifest.json', 'versions/baseline.json', ...manifest.node_files, ...manifest.edge_files];
for (const file of files) { const target = join(runtimeRoot, file); await mkdir(dirname(target), { recursive: true }); await cp(join(sourceRoot, file), target); }
console.log(`Published ${files.length} knowledge-graph data files to ${runtimeRoot}.`);
