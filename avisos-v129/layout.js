(function(){'use strict';
function labelOf(d,id){const e=d.getElementById(id);return e?e.closest('label'):null}
function section(d,re){return Array.from(d.querySelectorAll('#formAviso .sectionTitle')).find(x=>re.test(String(x.textContent||'').trim()))||null}
function insertBefore(node,ref){if(node&&ref&&ref.parentNode)ref.parentNode.insertBefore(node,ref)}
function insertAfter(node,ref){if(node&&ref&&ref.parentNode)ref.insertAdjacentElement('afterend',node)}
function patch(d){const form=d.getElementById('formAviso'),grid=form&&form.querySelector('.grid2');if(!grid)return;
  const cliente=labelOf(d,'avCliente'),contacto=labelOf(d,'avContacto'),nif=labelOf(d,'avNif'),tel=labelOf(d,'avTelefono'),mail=labelOf(d,'avEmail');
  const ref=labelOf(d,'avRefCatastral'),prov=labelOf(d,'avProvincia');
  let loc=section(d,/UBICACIÓN DEL SUMINISTRO|CLIENTE Y SUMINISTRO/i);if(!loc)return;loc.textContent='UBICACIÓN DEL SUMINISTRO';
  let cli=d.getElementById('v129ClienteTitle');if(!cli){cli=d.createElement('div');cli.id='v129ClienteTitle';cli.className='sectionTitle wide';cli.textContent='FICHA DE CLIENTE'}
  if(cliente)insertBefore(cli,cliente);else insertBefore(cli,loc);
  [cliente,contacto,nif,tel,mail].forEach(n=>{if(n)grid.insertBefore(n,loc)});
  const iban=d.getElementById('v122Iban'),cond=d.getElementById('v122Cond'),contr=d.getElementById('v122Contrato');
  const ibanLab=iban&&iban.closest('label'),condBox=cond&&cond.closest('.v122switch'),contrBox=contr&&contr.closest('.v122switch');
  [ibanLab,condBox,contrBox].forEach(n=>{if(n)grid.insertBefore(n,loc)});
  if(ref)insertBefore(loc,ref);

  const cupsReq=d.getElementById('v127CupsBox'),cupsE=labelOf(d,'avCupsE'),cupsG=labelOf(d,'avCupsG');
  if(prov&&cupsReq)insertAfter(cupsReq,prov);
  let anchor=cupsReq||prov;
  if(anchor&&cupsE){insertAfter(cupsE,anchor);anchor=cupsE}
  if(anchor&&cupsG){insertAfter(cupsG,anchor);anchor=cupsG}

  const carto=d.querySelector('#formAviso .cartoBox'),plan=d.getElementById('v122Box');
  if(carto&&anchor){insertAfter(carto,anchor);anchor=carto}
  if(plan&&anchor){insertAfter(plan,anchor);anchor=plan;const s=plan.querySelector(':scope > strong');if(s)s.textContent='PLANO DE SITUACIÓN'}

  const elec=section(d,/DATOS ELÉCTRICOS/i),extra=d.getElementById('v129SupplyBox');if(elec&&extra)insertBefore(extra,elec);
}
function walk(w,s){if(!w||s.has(w))return;s.add(w);let d;try{d=w.document}catch(e){return}try{patch(d);Array.from(d.querySelectorAll('iframe')).forEach(f=>{try{walk(f.contentWindow,s)}catch(e){}})}catch(e){}}
function scan(){walk(window,new Set())}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();setInterval(scan,700);
})();
