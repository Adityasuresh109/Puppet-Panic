import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const files=['index.html','style.css','src/physics.js','src/main.js','src/audio.js','host.html','controller.html','room.css','src/host.js','src/controller.js','src/teams.js','src/transport.js','src/qr.js'];
for (const file of files) {
  const source=path.join(root,file), target=path.join(root,'dist',file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(source,target);
}
console.log(`Static production build: ${files.length} files in dist/`);