import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const files=[
  'index.html','lab.html','style.css',
  'src/physics.js','src/main.js','src/audio.js',
  'host.html','controller.html','room.css',
  'src/host.js','src/controller.js','src/teams.js','src/transport.js','src/qr.js'
];

for (const file of files) {
  const source=path.join(root,file);
  const target=path.join(root,'dist',file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.copyFileSync(source,target);
}
// Canonical public entrance is the real host screen, not the physics lab.
// /play.html is an additional fresh path for avoiding stale browser caches.
for(const entry of ['index.html','play.html']){
  fs.copyFileSync(path.join(root,'host.html'),path.join(root,'dist',entry));
}
console.log(`Static production build: ${files.length} sources; public multiplayer entry at / and /play.html; solo development lab at /lab.html`);
