(function(){'use strict';
const BUILD='V135-DETAILS-CLOSED1';
const marked=new WeakSet();
function closeNode(n){
  if(!n||n.nodeType!==1)return;
  if(n.matches&&n.matches('details')){
    if(!marked.has(n)){n.open=false;marked.add(n)}
  }
  if(n.querySelectorAll)for(const d of n.querySelectorAll('details')){if(!marked.has(d)){d.open=false;marked.add(d)}}
}
function init(w){
  if(!w||!w.document||w.__soltecDetailsClosed135)return;
  w.__soltecDetailsClosed135=true;
  const d=w.document;
  closeNode(d.documentElement);
  try{
    new w.MutationObserver(list=>{
      for(const m of list)for(const n of m.addedNodes||[])closeNode(n);
    }).observe(d.documentElement||d,{childList:true,subtree:true});
  }catch(_){}
}
window.Soltec135DetailsClosed={init,version:BUILD};
})();
