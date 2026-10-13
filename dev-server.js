import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
const port=Number(process.env.PORT)||4173;
http.createServer(async(req,res)=>{
  const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const target=path.resolve(root,`.${route==='/'?'/index.html':route}`);
  if(!target.startsWith(root+path.sep)&&target!==root) {res.writeHead(403);res.end();return;}
  try {
    const data=await fs.readFile(target);
    res.writeHead(200,{'content-type':types[path.extname(target)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
  }catch {res.writeHead(404);res.end('Not found');}
}).listen(port,'0.0.0.0',()=>console.log(`Puppet Lab running on http://localhost:${port}`));