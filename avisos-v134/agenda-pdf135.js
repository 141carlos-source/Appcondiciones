(function(){'use strict';
const KEY='SOLTEC_AGENDA_V1',W=1240,H=1754,M=48;
const $=id=>document.getElementById(id);
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return[]}}
function current(){try{if(window.SoltecAgendaCore&&typeof window.SoltecAgendaCore.formSnapshot==='function')return window.SoltecAgendaCore.formSnapshot()}catch(_){}const id=String(($('id')||{}).value||'');return read().find(r=>String(r.id)===id)||null}
function font(c,s,b){c.font=(b?'700 ':'400 ')+s+'px Arial';c.fillStyle='#182033';c.textBaseline='top'}
function wrap(c,t,x,y,w,lh,max){const out=[];for(const p of String(t||'—').split(/\r?\n/)){let line='';for(const word of p.split(/\s+/).filter(Boolean)){const q=line?line+' '+word:word;if(c.measureText(q).width>w&&line){out.push(line);line=word}else line=q}if(line)out.push(line);if(!p)out.push('')}const rows=max?out.slice(0,max):out;rows.forEach((r,i)=>c.fillText(r,x,y+i*lh));return Math.max(lh,rows.length*lh)}
function image(src){return new Promise(ok=>{if(!src||!String(src).startsWith('data:image/'))return ok(null);const im=new Image();im.onload=()=>ok(im);im.onerror=()=>ok(null);im.src=src})}
function fit(c,im,x,y,w,h){if(!im)return;const s=Math.min(w/im.width,h/im.height),iw=im.width*s,ih=im.height*s;c.drawImage(im,x+(w-iw)/2,y+(h-ih)/2,iw,ih)}
function bytes(url){const bin=atob(url.split(',')[1]),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u}
function ascii(v){return new TextEncoder().encode(v)}
function join(a){const n=a.reduce((s,x)=>s+x.length,0),u=new Uint8Array(n);let o=0;a.forEach(x=>{u.set(x,o);o+=x.length});return u}
function pdf(canvas){
 const img=bytes(canvas.toDataURL('image/jpeg',.88)),objs=[];
 objs[1]=ascii('<< /Type /Catalog /Pages 2 0 R >>');
 objs[2]=ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 objs[3]=ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>');
 objs[4]=join([ascii('<< /Type /XObject /Subtype /Image /Width '+canvas.width+' /Height '+canvas.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+img.length+' >>\nstream\n'),img,ascii('\nendstream')]);
 const stream='q\n595 0 0 842 0 0 cm\n/Im1 Do\nQ\n';objs[5]=ascii('<< /Length '+stream.length+' >>\nstream\n'+stream+'endstream');
 const chunks=[ascii('%PDF-1.4\n')],offs=[0];let pos=chunks[0].length;
 for(let i=1;i<=5;i++){offs[i]=pos;const h=ascii(i+' 0 obj\n'),t=ascii('\nendobj\n');chunks.push(h,objs[i],t);pos+=h.length+objs[i].length+t.length}
 const xref=pos;let s='xref\n0 6\n0000000000 65535 f \n';for(let i=1;i<=5;i++)s+=String(offs[i]).padStart(10,'0')+' 00000 n \n';s+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
 chunks.push(ascii(s));return new Blob([join(chunks)],{type:'application/pdf'})
}
async function make(){
 const r=current();if(!r){alert('No hay datos de cita para crear el PDF.');return}
 const src=document.createElement('canvas');src.width=W;src.height=3200;const c=src.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,src.width,src.height);let y=M;
 c.fillStyle='#e7281c';c.fillRect(M,y,W-M*2,6);y+=18;font(c,32,true);c.fillText('SOLTEC · CITA DE AGENDA',M,y);y+=50;
 font(c,14,true);c.fillStyle='#667085';c.fillText('FECHA / HORA',M,y);c.fillText('ESTADO',650,y);y+=18;font(c,20,false);c.fillStyle='#182033';c.fillText([r.date,r.time].filter(Boolean).join(' · ')||'—',M,y);c.fillText(r.status||'Pendiente',650,y);y+=42;
 const fields=[['TRABAJO',r.title],['CLIENTE',r.client],['OBRA',r.work],['DIRECCIÓN',r.address],['TELÉFONO',r.phone],['TÉCNICO',r.tech],['DURACIÓN',r.duration?r.duration+' h':'—'],['PRIORIDAD',r.priority||'—']];
 for(const [lab,val] of fields){font(c,13,true);c.fillStyle='#667085';c.fillText(lab,M,y);font(c,18,false);c.fillStyle='#182033';y+=18;y+=wrap(c,val,M,y,W-M*2,23,3)+12}
 c.strokeStyle='#d6dbe3';c.beginPath();c.moveTo(M,y);c.lineTo(W-M,y);c.stroke();y+=18;
 font(c,22,true);c.fillStyle='#e7281c';c.fillText('Notas',M,y);y+=32;font(c,16,false);c.fillStyle='#182033';y+=wrap(c,r.notes||'—',M,y,W-M*2,22,8)+12;
 const mats=Array.isArray(r.materials)?r.materials:[];if(mats.length){font(c,22,true);c.fillStyle='#e7281c';c.fillText('Material previsto',M,y);y+=32;for(const x of mats){font(c,16,false);c.fillStyle='#182033';c.fillText('• '+(x.qty?x.qty+' × ':'')+(x.text||''),M,y);y+=23}y+=8}
 const ck=Array.isArray(r.checklist)?r.checklist:[];if(ck.length){font(c,22,true);c.fillStyle='#e7281c';c.fillText('Checklist',M,y);y+=32;for(const x of ck){font(c,16,false);c.fillStyle='#182033';c.fillText((x.done?'☑ ':'☐ ')+(x.text||''),M,y);y+=23}y+=8}
 const photos=(Array.isArray(r.photos)?r.photos:[]).slice(0,6);if(photos.length){font(c,22,true);c.fillStyle='#e7281c';c.fillText('Fotografías',M,y);y+=34;const ims=await Promise.all(photos.map(image)),cols=Math.min(3,ims.length),gap=12,pw=(W-M*2-gap*(cols-1))/cols,ph=160;ims.forEach((im,i)=>{const row=Math.floor(i/cols),col=i%cols,x=M+col*(pw+gap),yy=y+row*(ph+gap);c.strokeStyle='#d6dbe3';c.strokeRect(x,yy,pw,ph);fit(c,im,x+4,yy+4,pw-8,ph-8)});y+=Math.ceil(ims.length/cols)*(ph+gap)+8}
 const out=document.createElement('canvas');out.width=W;out.height=H;const o=out.getContext('2d');o.fillStyle='#fff';o.fillRect(0,0,W,H);const scale=Math.min(1,(W-68)/(W-M*2),(H-90)/(y-M));o.drawImage(src,M,M,W-M*2,y-M,34,34,(W-M*2)*scale,(y-M)*scale);
 const blob=pdf(out),a=document.createElement('a'),safe=String(r.title||'cita').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');a.href=URL.createObjectURL(blob);a.download='SOLTEC_CITA_'+(safe||r.id)+'.pdf';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1200)
}
function bind(){const b=$('agendaPdfBtn');if(b&&!b.dataset.pdf){b.dataset.pdf='1';b.onclick=make}}
bind();setInterval(bind,700);window.SoltecAgendaPdf135={make};
})();