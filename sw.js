// Network-first updates; cache a complete release for installed/offline copies.
const CACHE='selvedge-workroom-v3-2';
const FILES=["./", "./index.html", "./manifest.webmanifest", "./v3/simple.js", "./v3/measurement-help.js", "./v3/app.js", "./v3/model.js", "./v3/pattern-view.js", "./v3/layout-view.js", "./v3/theme.js", "./v3/minimal.css", "./v3/assets/yh-logo.svg", "./v3/assets/playfair-display.woff2", "./v3/assets/apple-touch-icon.png", "./v3/assets/icon-192.png", "./v3/assets/icon-512.png", "./measure.html", "./measure.css", "./measure.js", "./measure-visuals.js", "./appearance.js", "./app.css", "./assets/yh-monogram.png", "./icon.svg", "./favicon-32.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./media/fpg.pdf", "./media/bpg.pdf", "./media/example-pattern.pdf"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('selvedge-workroom-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));}
  return response;
 }).catch(async()=>await caches.match(event.request,{ignoreSearch:true})||new Response('This file is not available offline yet.',{status:503,headers:{'Content-Type':'text/plain'}})));
});
