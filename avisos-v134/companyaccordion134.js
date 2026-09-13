(function(){'use strict';
function addStyle(d){if(d.getElementById('s134CompanyAccordionStyle'))return;const s=d.createElement('style');s.id='s134CompanyAccordionStyle';s.textContent='.s134cfgacc{border:1px solid #dfe4ea;border-radius:12px;margin:9px 0;overflow:hidden;background:#fff}.s134cfgacc>summary{cursor:pointer;padding:13px 12px;font-weight:900;background:#f8fafc;color:#24466e;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px}.s134cfgacc>summary::-webkit-details-marker{display:none}.s134cfgacc>summary:after{content:"⌄";font-size:18px;color:#667085;transition:transform .15s ease}.s134cfgacc[open]>summary:after{transform:rotate(180deg)}.s134cfgbody{padding:11px}.s134cfgacc[open]>summary{border-bottom:1px solid #dfe4ea;background:#eef5ff}.s134cfgsave{margin-top:12px}';d.head.appendChild(s)}
function gridFor(d,id){const n=d.getElementById(id);return n&&n.closest?n.closest('.grid2'):null}
function titleNode(card,re){return Array.from(card.children).find(n=>n.classList&&n.classList.contains('sectionTitle')&&re.test(n.textContent||''))||null}
function make(d,id,label,open){const x=d.createElement('details');x.id=id;x.className='s134cfgacc';x.open=!!open;const s=d.createElement('summary');s.textContent=label;const b=d.createElement('div');b.className='s134cfgbody';x.appendChild(s);x.appendChild(b);return{x,body:b}}
function inject(w){const d=w.document,card=d.querySelector('#config .card');if(!card||d.getElementById('s134CfgEmpresa'))return;addStyle(d);
const empresaTitle=titleNode(card,/^\s*Empresa\s*$/i),tecnicoTitle=titleNode(card,/T[eé]cnico\s*\/\s*instalador/i),solTitle=titleNode(card,/Solicitante predeterminado/i),logo=card.querySelector('.logoBox'),empresaGrid=gridFor(d,'empresaNombre'),tecnicoGrid=gridFor(d,'tecnicoNombre'),solGrid=gridFor(d,'solNombre'),save=Array.from(card.querySelectorAll('button')).find(b=>/Guardar configuraci[oó]n de empresa/i.test(b.textContent||'')),estado=d.getElementById('estadoEmpresa');
if(!empresaGrid||!tecnicoGrid||!solGrid)return;
const e=make(d,'s134CfgEmpresa','🏢 EMPRESA E IDENTIDAD VISUAL',true),t=make(d,'s134CfgTecnico','🧰 TÉCNICO / INSTALADOR',false),q=make(d,'s134CfgSolicitante','👤 SOLICITANTE PREDETERMINADO',false);
const insertAt=empresaTitle||empresaGrid;card.insertBefore(e.x,insertAt);card.insertBefore(t.x,insertAt);card.insertBefore(q.x,insertAt);
if(logo)e.body.appendChild(logo);e.body.appendChild(empresaGrid);t.body.appendChild(tecnicoGrid);
if(solTitle&&solTitle.nextElementSibling&&solTitle.nextElementSibling.classList&&solTitle.nextElementSibling.classList.contains('muted'))q.body.appendChild(solTitle.nextElementSibling);q.body.appendChild(solGrid);
[empresaTitle,tecnicoTitle,solTitle].forEach(n=>{if(n&&n.parentNode)n.remove()});
if(save){save.classList.add('s134cfgsave');card.appendChild(save)}if(estado)card.appendChild(estado);
Array.from(card.children).forEach(n=>{if(n.tagName==='DETAILS'&&n.id!=='s134CfgEmpresa')n.open=false});
}
window.Soltec134CompanyAccordion={init:function(w){try{inject(w)}catch(e){console.error('V1.34 EMPRESA DESPLEGABLES',e)}}};
})();
