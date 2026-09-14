(function(){'use strict';
const B='V135-AVISOS1-CLIENTE-CUPS';let done=false;
function frame(){try{let f=document.getElementById('app134');return f&&f.contentWindow&&f.contentWindow.document?f.contentWindow:null}catch(e){return null}}
function lab(d,id){let n=d.getElementById(id);return n&&n.closest?n.closest('label'):null}
function moveCups(){let w=frame();if(!w)return;let d=w.document,phone=lab(d,'avTelefono'),e=lab(d,'avCupsE'),g=lab(d,'avCupsG');if(!phone||!e||!g)return;let note=e.nextElementSibling===g?g.nextElementSibling:null;if(!(note&&note.classList&&note.classList.contains('muted')))note=g.nextElementSibling;
try{e.classList.add('wide');g.classList.add('wide');if(note&&note.parentNode){note.classList.add('wide');note.style.margin='0 0 8px';}}
catch(x){}
let after=phone.nextSibling;phone.parentNode.insertBefore(e,after);phone.parentNode.insertBefore(g,e.nextSibling);if(note&&note.parentNode)phone.parentNode.insertBefore(note,g.nextSibling);
let input=d.getElementById('avCupsE');if(input){input.placeholder='CUPS electricidad';input.autocomplete='off'}let inputG=d.getElementById('avCupsG');if(inputG){inputG.placeholder='CUPS gas';inputG.autocomplete='off'}done=true;}
function init(){moveCups();setTimeout(moveCups,300);setTimeout(moveCups,1000);setInterval(function(){if(!done)moveCups()},2000)}
window.Soltec135AvisosCliente={init:init,version:B};init();
})();