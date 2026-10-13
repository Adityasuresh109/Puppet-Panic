import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';
const root=new URL('../',import.meta.url);
const read=(p)=>readFileSync(new URL(p,root),'utf8');
test('public game entry has no Solo Lab navigation',()=>{
  assert.doesNotMatch(read('host.html'),/open\s+solo\s+lab/i);
  assert.match(read('host.html'),/id="create-room"/);
});
test('static root and play route deploy the multiplayer host; lab remains available separately',()=>{
  execFileSync(process.execPath,['scripts/build.js'],{cwd:root,stdio:'pipe'});
  const host=read('host.html');
  assert.equal(read('dist/index.html'),host);
  assert.equal(read('dist/play.html'),host);
  assert.equal(read('dist/host.html'),host);
  assert.equal(read('dist/lab.html'),read('lab.html'));
});