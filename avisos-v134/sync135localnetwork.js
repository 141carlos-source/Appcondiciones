(function(){'use strict';
const BUILD='V135-LNA1';
function localTarget(input,base){
  try{
    const raw=typeof input==='string'?input:(input&&input.url)||'';
    const u=new URL(raw,base||location.href),h=String(u.hostname||'').toLowerCase();
    if(h==='localhost'||h.endsWith('.local')||h.endsWith('.ts.net'))return true;
    if(/^127\./.test(h)||/^10\./.test(h)||/^192\.168\./.test(h)||/^169\.254\./.test(h))return true;
    let m=h.match(/^172\.(\d+)\./);if(m&&Number(m[1])>=16&&Number(m[1])<=31)return true;
    m=h.match(/^100\.(\d+)\./);if(m&&Number(m[1])>=64&&Number(m[1])<=127)return true;
  }catch(_){}
  return false;
}
function init(w){
  if(!w||w.__soltecLna135)return;
  const nativeFetch=w.fetch&&w.fetch.bind(w);
  if(!nativeFetch)return;
  w.fetch=function(input,options){
    if(!localTarget(input,w.location&&w.location.href))return nativeFetch(input,options);
    const next=Object.assign({},options||{});
    if(next.targetAddressSpace==null)next.targetAddressSpace='local';
    return nativeFetch(input,next);
  };
  w.__soltecLna135={version:BUILD};
}
window.Soltec135LocalNetwork={init,version:BUILD};
})();
