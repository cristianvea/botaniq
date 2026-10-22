// Junta la demo compilada (dist-demo) en un único archivo HTML listo para publicar como página.
import fs from 'node:fs';
import path from 'node:path';

const dir = 'dist-demo';
const out = process.argv[2] || 'botaniq-demo.html';
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = html.match(/<script[^>]*src="\.?\/?(assets\/[^"]+\.js)"/)[1];
const css = html.match(/<link[^>]*href="\.?\/?(assets\/[^"]+\.css)"/)[1];
const code = fs.readFileSync(path.join(dir, js), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = fs.readFileSync(path.join(dir, css), 'utf8');

const page = `<title>BotanIQ</title>
<meta name="description" content="Demo interactiva de BotanIQ: riego inteligente de plantas según la especie, la maceta y el tiempo.">
<style>${style}</style>
<div id="root"></div>
<script type="module">${code}</script>
`;
fs.writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024).toFixed(0)} KB`);
