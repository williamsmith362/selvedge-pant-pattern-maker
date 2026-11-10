// Network first: new visits receive the current app; an installed copy works offline.
const CACHE='selvedge-workroom-v2-11-simple-example';
const FILES=['./','./index.html','./app.css','./app.js','./appearance.js','./assets/yh-monogram.png','./model.js','./measure.html','./measure.css','./measure.js','./measure-visuals.js','./manifest.webmanifest','./icon.svg','./favicon-32.png','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./media/fpg.pdf','./media/bpg.pdf','./media/example-pattern.pdf'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('selvedge-workroom-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));}
  return response;
 }).catch(async()=>{
  const cached=await caches.match(event.request,{ignoreSearch:true});
  return cached||new Response('This file is not available offline yet.',{status:503,headers:{'Content-Type':'text/plain'}});
 }));
});
