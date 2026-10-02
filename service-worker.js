const CACHE="marvel-store-v1";
const CORE=["./","./index.html","./assets/css/style.css","./assets/js/app.js","./assets/js/config.js","./assets/js/firebase.js","./assets/js/images.js","./assets/js/store.js","./assets/js/utils.js","./assets/js/admin.js","./manifest.webmanifest","./assets/icons/favicon.svg"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin)return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match("./index.html"))));
});
