(function(){'use strict';
const BUILD='V135-CNMC-AVISO1';let W=null,timer=0,bound=false;
function d(){return W&&W.document}function e(id){const x=d();return x&&x.getElementById(id)}
function num(id){const n=parseFloat(String((e(id)||{}).value||'').replace(',','.'));return Number.isFinite(n)?n:0}
function fmt(n){return String(Math.round(n*100)/100).replace('.',',')}
function calc(){const out=e('t135PotenciaTotal');if(!out)return;let a=0,b=0,c=0,g=0;for(let i=1;i<=3;i++)a+=num('t135VivPotencia'+i);for(let i=1;i<=2;i++)b+=num('t135LocPotencia'+i);for(let i=0;i<3;i++)c+=num('t135SerPotencia'+i);for(let i=0;i<2;i++)g+=num('t135GarPotencia'+i);out.value=fmt(a+b+c+g);out.readOnly=true;out.dataset.cnmcAuto='1';const lab=out.closest&&out.closest('label');if(lab&&lab.firstChild)lab.firstChild.nodeValue='Potencia solicitada CNMC · A+B+C+D (kW)'}
function place(){const x=d(),box=e('s135Technical');if(!x||!box)return false;const sum=box.querySelector(':scope > summary');if(sum)sum.textContent='📄 CNMC · Datos técnicos';const buttons=Array.from(x.querySelectorAll('#formAviso button,input[type="submit"]'));const save=buttons.find(n=>/GUARDAR\s+AVISO/i.test(String(n.textContent||n.value||'')));if(save){const anchor=save.closest('.row')||save.closest('.actions')||save;if(anchor&&anchor.parentNode&&box.nextSibling!==anchor)anchor.parentNode.insertBefore(box,anchor)}calc();return true}
function bind(){const x=d();if(!x||bound)return;bound=true;x.addEventListener('input',ev=>{const id=String(ev.target&&ev.target.id||'');if(/^t135(Viv|Loc|Ser|Gar)Potencia/.test(id))calc()},true);x.addEventListener('change',ev=>{const id=String(ev.target&&ev.target.id||'');if(/^t135(Viv|Loc|Ser|Gar)Potencia/.test(id))calc()},true)}
function tick(){if(!W){try{const f=document.getElementById('app134');if(f&&f.contentWindow&&f.contentWindow.document)W=f.contentWindow}catch(_){}}if(!W)return;bind();place()}
function init(w){if(w)W=w;tick();if(timer)return;timer=setInterval(tick,500);setTimeout(tick,120);setTimeout(tick,700);setTimeout(tick,1600)}
window.Soltec135CnmcPosition={init,version:BUILD};init();
})();
