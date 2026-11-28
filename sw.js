const V='hitboard-v312';
const SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png'];
/* v311: the app opens from the copy saved on the phone (instant, no 2 MB download each time). A new version is picked up
   when this file changes: the new copy is saved in the background and used from the next open (or the Update banner). */
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>fetch(new Request(u,{cache:'reload'})).then(r=>r.ok?c.put(u,r):null).catch(()=>null)))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  if(u.origin!==location.origin)return; // scores, odds and fonts go straight to the network
  if(u.search||u.pathname.endsWith('sw.js'))return; // version checks always ask the server
  const key=e.request.mode==='navigate'?'index.html':e.request;
  e.respondWith(caches.open(V).then(c=>c.match(key).then(m=>m||fetch(e.request).then(r=>{if(r.ok)c.put(key,r.clone());return r}))).catch(()=>caches.match('index.html')));
});
