import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {test} from 'node:test';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('public host has no Solo Lab navigation or development shortcuts',()=>{
  const html=read('host.html');
  assert.doesNotMatch(html,/open\s+solo\s+lab/i);
  assert.doesNotMatch(html,/href=["']\.\/lab\.html/i);
  assert.match(html,/id="create-room"/);
  assert.match(html,/\.\/src\/host\.js/);
});

test('local root redirects to the host, and the Solo Lab is separately available',()=>{
  assert.match(read('index.html'),/location\.replace\(new URL\('\.\/host\.html'/);
  assert.match(read('lab.html'),/\.\/src\/main\.js/);
});

test('GitHub Pages build serves multiplayer at root and fresh play route',()=>{
  execFileSync(process.execPath,['scripts/build.js'],{cwd:new URL('../',import.meta.url),stdio:'pipe'});
  const host=read('host.html');
  assert.equal(read('dist/index.html'),host);
  assert.equal(read('dist/play.html'),host);
  assert.equal(read('dist/host.html'),host);
  assert.equal(read('dist/lab.html'),read('lab.html'));
  assert.doesNotMatch(read('dist/index.html'),/open\s+solo\s+lab/i);
});
