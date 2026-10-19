import fs from 'node:fs';import path from 'node:path';
const base=process.cwd(),out=path.join(base,'dist-v2');
fs.rmSync(out,{recursive:true,force:true});
const files=['grand-prix.html','grand-prix-controller.html','src/v2/rules.js','src/v2/physics.js','src/v2/host.js','src/v2/controller.js','src/v2/transport.js','src/v2/grandprix.css','src/qr.js'];
for(const p of files){const dst=path.join(out,p);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(base,p),dst);}
fs.copyFileSync(path.join(base,'grand-prix.html'),path.join(out,'index.html'));
console.log('Built '+files.length+' Grand Prix preview assets with isolated index.html');