/* SOLTEC V2 · Autorización de representatividad (e-distribución): datos y documento, sin pantalla.
   Modelo de datos (claves), validación (NIF/NIE/CIF, correo, CP, teléfono), formulario por grupos, pendientes,
   el documento A4 en HTML (2 páginas) y los textos del correo. Se usa en autorizacion.html (window.AutorizacionDatos)
   y en las pruebas. Nada de esto toca la pantalla, el almacenamiento ni la red. */
(function (raiz, fabrica) {
  const A = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = A;
  else raiz.AutorizacionDatos = A;
})(typeof globalThis !== 'undefined' ? globalThis : self, function () {
'use strict';
const SCHEMA_ID = 'soltec.autorizacion-representatividad';
const SCHEMA_VER = 1;

/* Todas las claves del modelo (string). '' = vacío. */
const KEYS = [
  // Solicitante / promotor
  'sol_nombre','sol_nif','sol_municipio','sol_via','sol_email','sol_tel','sol_opcion', // opcion: 'A' | 'B'
  'ent_nombre','ent_cargo','ent_nif','ent_email','ent_tel',
  // Destinatario de facturación: '' (solicitante) | 'rep' | 'ter'
  'fact_opcion',
  'rf_nombre','rf_nif','rf_calle','rf_cp','rf_municipio','rf_provincia','rf_pais',
  'tf_nombre','tf_nif','tf_calle','tf_cp','tf_municipio','tf_provincia','tf_pais','tf_contacto','tf_mail',
  'dir3_oc','dir3_oc_d','dir3_og','dir3_og_d','dir3_ut','dir3_ut_d','dir3_exp',
  // Autorizado (representante)
  'aut_nombre','aut_nif','aut_municipio','aut_via','aut_email','aut_tel',
  // Datos de la solicitud
  'sum_dir','sum_dir2','sum_municipio','sum_provincia','sum_potencia',
  // Fecha y firmas (firmas = dataURL PNG)
  'firma_lugar','firma_dia','firma_mes','firma_anio','firma_sol','firma_rep','firma_dest',
  // Envío por correo: 'si' | 'no', destinatario y fecha del último envío
  'env_correo','env_para','env_fecha'
];
const empty = () => Object.fromEntries(KEYS.map(k => [k, '']));
const normalize = (o) => { const d = empty(); if (o) for (const k of KEYS) if (o[k] != null) d[k] = String(o[k]); return d; };

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const LPD = '<b>PROTECCIÓN DE DATOS</b> Le informamos de que EDistribución Redes Digitales, S.L.Unipersonal es el responsable del tratamiento de los datos personales que se necesiten recabar para la gestión de la solicitud de nuevo suministro/servicio y que está legitimada a tratar sus datos para cumplir con las obligaciones legales que establezca la normativa del sector eléctrico en cada momento o, en su caso, para la ejecución del contrato. Los datos personales que nos facilite no se cederán a terceros, salvo obligación legal. No obstante, podrán tener acceso a ellos los proveedores de servicios que EDistribución Redes Digitales, S.L.Unipersonal contrate o pueda contratar y que tengan la condición de encargados del tratamiento, algunos de los cuales pueden encontrarse localizados fuera del Espacio Económico Europeo. Le recordamos que puede ejercer sus derechos de acceso, rectificación, cancelación, oposición, portabilidad, así como cualquier otro que establezca la normativa en vigor en cada momento. Si desea ampliar la información pinche en el siguiente enlace <u>www.edistribucion.com</u>';

function header(L) {
  const top = L && L.show
    ? `<div class="lgrow"><div class="lg l">${L.soltec ? `<img src="${esc(L.soltec)}" alt="SOLTEC">` : ''}</div><div class="int">INTERNAL</div><div class="lg r">${L.edist ? `<img src="${esc(L.edist)}" alt="e-distribución">` : ''}</div></div>`
    : `<div class="int">INTERNAL</div>`;
  return `${top}
<h1 class="tt">Modelo de Autorización para Representatividad y Destinatario de Facturación</h1>
<div class="sub">La presentación de este formulario deroga íntegramente a representante y al destinatario de factura actuales.<br>Si representante o destinatario de factura debe mantenerse, rellenar con la misma información previa.</div>
<div class="sub sub2">Este documento es de uso exclusivo en una solicitud de conexión a la red de distribución, no siendo válido para otros usos.</div>`;
}

/* Genera las 2 páginas A4. editable=true → inputs sobre las líneas. */
function makeDoc(d, editable, L = LOGOS) {
  const HEADER = header(L);
  const F = (k, w, cls = '') => {
    const st = w === 'g' ? 'flex:1 1 0' : `width:${w}mm;flex:none`;
    return editable
      ? `<input class="f ${cls}" data-k="${k}" value="${esc(d[k])}" style="${st}" autocomplete="off" spellcheck="false" aria-label="${k}">`
      : `<span class="f ${cls}" style="${st}">${esc(d[k])}</span>`;
  };
  const C = (k, v, big) => {
    const on = d[k] === v;
    return editable
      ? `<span class="cb ${big ? 'big' : ''} ${on ? 'on' : ''}" data-k="${k}" data-v="${v}" role="checkbox" tabindex="0" aria-checked="${on}"></span>`
      : `<span class="cb ${big ? 'big' : ''} ${on ? 'on' : ''}"></span>`;
  };
  const S = (k) => {
    const inner = d[k] ? `<img src="${esc(d[k])}" alt="Firma">` : '<div class="sigph"></div>';
    return editable ? `<div class="sigz" data-sig="${k}" tabindex="0" role="button" title="Pulsa para firmar">${inner}</div>` : inner;
  };
  const lbl = t => `<span class="lb">${t}</span>`;

  const p1 = `<section class="page">
<div class="lpd">${LPD}</div>
${HEADER}
<div class="band">Solicitante/Promotor</div>
<div class="ln">D./ Dª ${F('sol_nombre','g')}<span>(<sup>1</sup>)</span>, con CIF/NIF</div>
<div class="ln">${F('sol_nif',27,'c')} y domicilio en (Municipio) ${F('sol_municipio','g')} (Vía pública y nº)</div>
<div class="ln">${F('sol_via','g')}<span>(<sup>2</sup>)</span>,<span style="width:12mm"></span>con e-mail</div>
<div class="ln">${F('sol_email',73)}, y teléfono de contacto ${F('sol_tel',30,'c')}, <span>(<sup>3</sup>)</span></div>
<div class="opt">${C('sol_opcion','A')}<span>[OPCIÓN A] actuando por cuenta propia</span></div>
<div class="opt">${C('sol_opcion','B')}<span style="display:flex;flex:1;align-items:flex-end">[OPCIÓN B] en representación de la Entidad ${F('ent_nombre','g')}</span></div>
<div class="ln ind">según cargo / poderes ${F('ent_cargo','g')}(4), con CIF/NIF ${F('ent_nif',33,'c')},</div>
<div class="ln ind">con e-mail ${F('ent_email','g')} y teléfono de contacto ${F('ent_tel',33,'c')},</div>
<p class="j" style="margin-top:4.4mm!important"><b>DECLARO bajo mi responsabilidad</b>, a efectos de la solicitud de suministro/servicio/generación en la dirección abajo indicada, que tengo interés legítimo para efectuar esta petición puesto que dispongo del título suficiente en relación con la propiedad o posesión de la finca, representación del titular de la finca, expectativa de adquirir la propiedad o el alquiler, etc. DECLARO que esta manifestación es fiel y auténtica <span>(<sup>5</sup>)</span>, y en virtud de la misma,</p>
<p class="j"><b>AUTORIZO <u>para que, en su propio nombre y por cuenta del autorizado</u>, el representante pueda realizar todas las acciones necesarias para su gestión.</b></p>
<p class="j"><b>SOLICITO, <span class="red">EN CASO DE QUE NO PROCEDA FACTURAR A NOMBRE DEL SOLICITANTE</span>, bajo mi responsabilidad, que la distribuidora facture al destinatario <span class="red">(sólo marcar y rellenar una de las dos opciones si no se debe facturar a nombre del solicitante)</span>:</b></p>
<div class="fo" style="margin-top:6.5mm">${C('fact_opcion','rep',true)}Representante, quien se subroga en la posición contractual del solicitante/promotor y, por tanto, en las obligaciones que dimanan del mismo, sin perjuicio de la obligación de información al solicitante/promotor de la gestión del expediente de conformidad al RD 1048/2013. <small>(La empresa distribuidora se reserva el derecho de admisión si se solicita con posterioridad al pago y su facturación al solicitante actual)</small>:</div>
<div class="grid">
 <div class="ln">${lbl('Nombre/Razón Social:')}${F('rf_nombre','g')}</div>
 <div class="ln">${lbl('NIF/CIF/NIE/Pasaporte:')}${F('rf_nif','g')}</div>
 <div class="ln">Dirección Social/Fiscal (si no coincidiera con la dirección indicada en los datos del autorizado):</div>
 <div class="ln">${lbl('Calle/Vía Pública y Nº:')}${F('rf_calle','g')}</div>
 <div class="ln">CP: ${F('rf_cp',24,'c')}<span style="width:9mm"></span>Municipio: ${F('rf_municipio','g')}</div>
 <div class="ln">Provincia: ${F('rf_provincia',60)}<span style="width:5mm"></span>País: ${F('rf_pais',24)}</div>
</div>
<div class="fo" style="margin-top:5mm">${C('fact_opcion','ter',true)}Tercero, quien se subroga en la posición contractual del solicitante/promotor y, por tanto, en las obligaciones que dimanan del mismo, sin perjuicio de la obligación de información al solicitante/promotor de la gestión del expediente de conformidad al RD 1048/2013. <small>(La empresa distribuidora se reserva el derecho de admisión si se solicita con posterioridad al pago y su facturación al solicitante actual)</small>:</div>
<div class="foot">
 <div><sup>1</sup> Razón Social, nombre y apellidos del promotor del suministro (<b>solicitante</b>).</div>
 <div><sup>2</sup> Domicilio del promotor del suministro.</div>
 <div><sup>3</sup> Márquese la opción que proceda.</div>
 <div><sup>4</sup> En el caso de realizarse esta autorización por una persona física diferente del autorizador (siendo éste una entidad), debe identificarse dicha persona física. En caso contrario, no rellenar este apartado.</div>
 <div><sup>5</sup> Asumo las responsabilidades legales de toda falsedad u omisión, con indemnidad para la empresa distribuidora</div>
</div>
</section>`;

  const p2 = `<section class="page">
<div class="lpd">${LPD}</div>
${HEADER}
<div class="grid" style="margin-top:0">
 <div class="ln">${lbl('Nombre/Razón Social:')}${F('tf_nombre','g')}</div>
 <div class="ln">${lbl('NIF/CIF/NIE/Pasaporte:')}${F('tf_nif','g')}</div>
 <div class="ln">${lbl('Dirección Social/Fiscal:')}</div>
 <div class="ln">${lbl('Calle/Vía Pública y Nº:')}${F('tf_calle','g')}</div>
 <div class="ln">CP: ${F('tf_cp',24,'c')}<span style="width:9mm"></span>Municipio: ${F('tf_municipio','g')}</div>
 <div class="ln">Provincia: ${F('tf_provincia',60)}<span style="width:5mm"></span>País: ${F('tf_pais',24)}</div>
 <div class="ln">${lbl('Persona de contacto:')}${F('tf_contacto','g')}</div>
 <div class="ln">${lbl('Mail de contacto:')}${F('tf_mail','g')}</div>
</div>
<div class="ln" style="margin-top:4.6mm"><span><b>Si</b> el destinatario requiere factura a Administración Pública con formato <b>Facturae</b> según ley 25/2013, indicar <b>DIR3:</b></span></div>
<div class="dir3h"><span>Código (obligatorio)</span><span>Descripción (opcional)</span></div>
<div class="grid" style="margin-top:2mm">
 <div class="ln">OC: ${F('dir3_oc',36)}<span style="width:9mm"></span>${F('dir3_oc_d','g')}</div>
 <div class="ln">OG: ${F('dir3_og',36)}<span style="width:9mm"></span>${F('dir3_og_d','g')}</div>
 <div class="ln">UT: ${F('dir3_ut',36)}<span style="width:9mm"></span>${F('dir3_ut_d','g')}</div>
 <div class="ln">Expediente: ${F('dir3_exp',48)}<span style="width:7mm"></span>(sólo si procede)</div>
</div>
<div class="band" style="margin-top:6mm">Autorizado (Representante)</div>
<div class="ln">D. / Dª / La Entidad ${F('aut_nombre','g')}<span>(<sup>6</sup>)</span>, con</div>
<div class="ln">CIF/NIF ${F('aut_nif',27,'c')} y domicilio en (municipio) ${F('aut_municipio','g')} (vía</div>
<div class="ln">pública y nº) ${F('aut_via','g')}<span>(<sup>7</sup>)</span>, con e-</div>
<div class="ln">mail ${F('aut_email',72)}, y teléfono de contacto ${F('aut_tel',33,'c')},</div>
<div class="band" style="margin-top:4mm">Datos de la solicitud de suministro/servicio/generación</div>
<div class="ln">Dirección del suministro/servicio/generación: ${F('sum_dir','g')}</div>
<div class="ln">${F('sum_dir2','g')}</div>
<div class="ln">Municipio: ${F('sum_municipio','g')}<span style="width:4mm"></span>Provincia: ${F('sum_provincia',55)}</div>
<div class="ln">Potencia: ${F('sum_potencia',27,'c')}kW (<i>solo en caso de suministro/generación</i>).</div>
<p style="margin-top:5.5mm;line-height:1.45">Se expide esta autorización que firmo, como solicitante, en la fecha y lugar indicados, y, en los supuestos de representación y/o subrogación, con la aceptación y firma de los autorizados como representante y/o destinatario de facturación.</p>
<div class="fecha">En${F('firma_lugar',46,'c')}, a ${F('firma_dia',7,'c')} de ${F('firma_mes',33,'c')} de 20${F('firma_anio',7,'c')}</div>
<div class="sig">
 <div>Firma del solicitante o de la Empresa solicitante${S('firma_sol')}</div>
 <div>Firma de la persona o de la Empresa representante${S('firma_rep')}</div>
</div>
<div class="sig3">Firma de la persona o de la Empresa destinataria de la facturación <span class="red" style="font-size:8pt">(si no es una de las anteriores)</span>${S('firma_dest')}</div>
<div class="foot">
 <div><sup>6</sup> Razón Social, o nombre y apellidos del <b>autorizado</b> como representante.</div>
 <div><sup>7</sup> Domicilio de contacto del autorizado como representante.</div>
</div>
</section>`;
  return p1 + p2;
}


/* ---------- Validación ---------- */
function checkNIF(v) {
  v = (v || '').toUpperCase().replace(/[\s.\-]/g, '');
  if (!v) return null;
  const L = 'TRWAGMYFPDXBNJZSQVHLCKE';
  if (/^\d{8}[A-Z]$/.test(v)) return L[+v.slice(0, 8) % 23] === v[8] ? 'NIF' : false;
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) return L[+('XYZ'.indexOf(v[0]) + v.slice(1, 8)) % 23] === v[8] ? 'NIE' : false;
  if (/^[KLM]\d{7}[A-Z]$/.test(v)) return L[+v.slice(1, 8) % 23] === v[8] ? 'NIF' : false;
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    let a = 0, b = 0; const ds = v.slice(1, 8);
    for (let i = 0; i < 7; i++) { const n = +ds[i]; if (i % 2 === 0) { const x = n * 2; b += Math.floor(x / 10) + x % 10; } else a += n; }
    const c = (10 - (a + b) % 10) % 10, ch = v[8];
    return (ch === String(c) || ch === 'JABCDEFGHI'[c]) ? 'CIF' : false;
  }
  return 'otro'; // pasaporte u otro formato: no se puede verificar
}
const RX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  cp: /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/,
  tel: /^(\+?\d{2,3}\s?)?[6789]\d{2}\s?\d{3}\s?\d{3}$/,
  num: /^\d+([.,]\d+)?$/
};
function validate(type, v) {
  v = (v || '').trim(); if (!v) return '';
  if (type === 'nif') { const r = checkNIF(v); return r === false ? 'Letra o dígito de control incorrecto' : r === 'otro' ? 'Formato no reconocido (¿pasaporte?)' : ''; }
  if (type === 'email') return RX.email.test(v) ? '' : 'Email no válido';
  if (type === 'cp') return RX.cp.test(v) ? '' : 'CP de 5 cifras (01000–52999)';
  if (type === 'tel') return RX.tel.test(v.replace(/[\s.]/g, ' ')) ? '' : 'Teléfono no válido';
  if (type === 'num') return RX.num.test(v) ? '' : 'Solo número (ej. 5,75)';
  return '';
}

/* ---------- Esquema para versiones con formulario ---------- */
const PROVINCIAS = 'Álava,Albacete,Alicante,Almería,Asturias,Ávila,Badajoz,Barcelona,Burgos,Cáceres,Cádiz,Cantabria,Castellón,Ceuta,Ciudad Real,Córdoba,A Coruña,Cuenca,Girona,Granada,Guadalajara,Gipuzkoa,Huelva,Huesca,Illes Balears,Jaén,León,Lleida,Lugo,Madrid,Málaga,Melilla,Murcia,Navarra,Ourense,Palencia,Las Palmas,Pontevedra,La Rioja,Salamanca,Santa Cruz de Tenerife,Segovia,Sevilla,Soria,Tarragona,Teruel,Toledo,Valencia,Valladolid,Bizkaia,Zamora,Zaragoza'.split(',');
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const GROUPS = [
  { id: 'sol', title: 'Solicitante / Promotor', fields: [
    { k: 'sol_nombre', l: 'Nombre y apellidos / Razón social', req: 1, span: 4, hint: 'Promotor del suministro (nota 1)' },
    { k: 'sol_nif', l: 'CIF / NIF', t: 'nif', req: 1, span: 2 },
    { k: 'sol_via', l: 'Vía pública y nº', req: 1, span: 4, hint: 'Domicilio del promotor (nota 2)' },
    { k: 'sol_municipio', l: 'Municipio', req: 1, span: 2 },
    { k: 'sol_email', l: 'E-mail', t: 'email', span: 4 },
    { k: 'sol_tel', l: 'Teléfono de contacto', t: 'tel', span: 2 },
    { k: 'sol_opcion', l: 'Actúa (nota 3)', t: 'radio', req: 1, span: 6, opts: [['A', 'Opción A · Por cuenta propia'], ['B', 'Opción B · En representación de una entidad']] }
  ]},
  { id: 'ent', title: 'Entidad representada (Opción B)', when: d => d.sol_opcion === 'B', fields: [
    { k: 'ent_nombre', l: 'Entidad', req: 1, span: 4 },
    { k: 'ent_nif', l: 'CIF / NIF de la entidad', t: 'nif', req: 1, span: 2 },
    { k: 'ent_cargo', l: 'Cargo / poderes', span: 6, hint: 'Solo si firma una persona física distinta del autorizador (nota 4)' },
    { k: 'ent_email', l: 'E-mail', t: 'email', span: 4 },
    { k: 'ent_tel', l: 'Teléfono de contacto', t: 'tel', span: 2 }
  ]},
  { id: 'aut', title: 'Autorizado (Representante)', tools: 'aut', fields: [
    { k: 'aut_nombre', l: 'D. / Dª / La Entidad', req: 1, span: 4, hint: 'Razón social o nombre del autorizado (nota 6)' },
    { k: 'aut_nif', l: 'CIF / NIF', t: 'nif', req: 1, span: 2 },
    { k: 'aut_via', l: 'Vía pública y nº', span: 4, hint: 'Domicilio de contacto (nota 7)' },
    { k: 'aut_municipio', l: 'Municipio', span: 2 },
    { k: 'aut_email', l: 'E-mail', t: 'email', span: 4 },
    { k: 'aut_tel', l: 'Teléfono de contacto', t: 'tel', span: 2 }
  ]},
  { id: 'sum', title: 'Datos de la solicitud de suministro / servicio / generación', fields: [
    { k: 'sum_dir', l: 'Dirección del suministro / servicio / generación', req: 1, span: 6 },
    { k: 'sum_dir2', l: 'Dirección (continuación)', span: 6, hint: 'Segunda línea del impreso: polígono, parcela, ref. catastral…' },
    { k: 'sum_municipio', l: 'Municipio', req: 1, span: 3 },
    { k: 'sum_provincia', l: 'Provincia', req: 1, span: 2, list: 'provincias' },
    { k: 'sum_potencia', l: 'Potencia (kW)', t: 'num', span: 1, hint: 'Solo suministro/generación' }
  ]},
  { id: 'fac', title: 'Destinatario de facturación', fields: [
    { k: 'fact_opcion', l: 'Facturar a', t: 'radio', span: 6, opts: [['', 'Solicitante (no marcar nada)'], ['rep', 'Representante'], ['ter', 'Tercero']],
      hint: 'Solo marcar Representante o Tercero si NO se debe facturar a nombre del solicitante.' }
  ]},
  { id: 'rf', title: 'Facturación al representante', when: d => d.fact_opcion === 'rep', tools: 'rf', fields: [
    { k: 'rf_nombre', l: 'Nombre / Razón social', req: 1, span: 4 },
    { k: 'rf_nif', l: 'NIF / CIF / NIE / Pasaporte', t: 'nif', req: 1, span: 2 },
    { k: 'rf_calle', l: 'Calle / vía pública y nº', span: 6, hint: 'Dirección social/fiscal solo si no coincide con la del autorizado' },
    { k: 'rf_cp', l: 'CP', t: 'cp', span: 1 },
    { k: 'rf_municipio', l: 'Municipio', span: 2 },
    { k: 'rf_provincia', l: 'Provincia', span: 2, list: 'provincias' },
    { k: 'rf_pais', l: 'País', span: 1 }
  ]},
  { id: 'tf', title: 'Facturación a un tercero', when: d => d.fact_opcion === 'ter', fields: [
    { k: 'tf_nombre', l: 'Nombre / Razón social', req: 1, span: 4 },
    { k: 'tf_nif', l: 'NIF / CIF / NIE / Pasaporte', t: 'nif', req: 1, span: 2 },
    { k: 'tf_calle', l: 'Calle / vía pública y nº (dirección social/fiscal)', req: 1, span: 6 },
    { k: 'tf_cp', l: 'CP', t: 'cp', req: 1, span: 1 },
    { k: 'tf_municipio', l: 'Municipio', req: 1, span: 2 },
    { k: 'tf_provincia', l: 'Provincia', span: 2, list: 'provincias' },
    { k: 'tf_pais', l: 'País', span: 1 },
    { k: 'tf_contacto', l: 'Persona de contacto', span: 3 },
    { k: 'tf_mail', l: 'Mail de contacto', t: 'email', span: 3 }
  ]},
  { id: 'dir3', title: 'DIR3 · Factura a Administración Pública (Facturae, Ley 25/2013)', when: d => d.fact_opcion === 'ter', optional: 1, fields: [
    { k: 'dir3_oc', l: 'OC · Código', span: 2 }, { k: 'dir3_oc_d', l: 'OC · Descripción', span: 4 },
    { k: 'dir3_og', l: 'OG · Código', span: 2 }, { k: 'dir3_og_d', l: 'OG · Descripción', span: 4 },
    { k: 'dir3_ut', l: 'UT · Código', span: 2 }, { k: 'dir3_ut_d', l: 'UT · Descripción', span: 4 },
    { k: 'dir3_exp', l: 'Expediente (sólo si procede)', span: 3 }
  ]},
  { id: 'fir', title: 'Lugar y fecha', tools: 'fecha', fields: [
    { k: 'firma_lugar', l: 'En (lugar)', span: 3 },
    { k: 'firma_dia', l: 'Día', span: 1 },
    { k: 'firma_mes', l: 'Mes', span: 1, list: 'meses' },
    { k: 'firma_anio', l: 'Año (20__)', span: 1, hint: 'Dos cifras' }
  ]}
];
const SIG_KEYS = d => ['firma_sol', 'firma_rep'].concat(d.fact_opcion === 'ter' ? ['firma_dest'] : []);

/* Lista de pendientes (obligatorios vacíos o inválidos de grupos visibles) */
function issues(d, groups = GROUPS) {
  const out = [];
  groups.forEach(g => {
    if (g.when && !g.when(d)) return;
    g.fields.forEach(f => {
      const v = (d[f.k] || '').trim();
      if (f.req && f.t !== 'radio' && !v) out.push({ g: g.id, k: f.k, msg: `${g.title}: falta «${f.l}»` });
      else if (f.req && f.t === 'radio' && !v) out.push({ g: g.id, k: f.k, msg: `${g.title}: elige «${f.l}»` });
      else { const m = validate(f.t, v); if (m && !m.startsWith('Formato')) out.push({ g: g.id, k: f.k, msg: `${g.title} · ${f.l}: ${m}` }); }
    });
  });
  return out;
}

const SOLTEC_DEFAULT = { aut_nombre: 'M. A. SOLTEC SL', aut_nif: '', aut_municipio: 'La Puebla de Alfindén', aut_via: '', aut_email: '', aut_tel: '' };
/** Pone la fecha de hoy en «Lugar y fecha» (y el lugar del representante si está vacío). */
function fillToday(d, n = new Date()) {
  d.firma_dia = String(n.getDate()); d.firma_mes = MESES[n.getMonth()]; d.firma_anio = String(n.getFullYear()).slice(2);
  if (!d.firma_lugar) d.firma_lugar = d.aut_municipio || '';
}
function copyAutToRf(d) { d.rf_nombre = d.aut_nombre; d.rf_nif = d.aut_nif; }
const SIG_TITLES = { firma_sol: ['Firma del solicitante', 'o de la empresa solicitante'], firma_rep: ['Firma del representante', 'persona o empresa autorizada'], firma_dest: ['Firma del destinatario de la facturación', 'si no es ninguno de los anteriores'] };

/* ---------- Correo ---------- */
const sinAcentos = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Nombre del PDF: AUTORIZACION_REPRESENTATIVIDAD_<SOLICITANTE>.pdf */
const nombrePdf = (d) => 'AUTORIZACION_REPRESENTATIVIDAD_' + (sinAcentos(d.sol_nombre || 'CLIENTE').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'CLIENTE') + '.pdf';
const asuntoCorreo = (d) => 'Autorización de representatividad' + (d.sum_dir ? ' · ' + d.sum_dir : '');
const cuerpoCorreo = (d) => `Buenos días:\n\nLe enviamos la autorización de representatividad para la solicitud de suministro${d.sum_dir ? ' de ' + d.sum_dir : ''}. Por favor, revísela, fírmela y devuélvanosla.\n\nGracias.\n${d.aut_nombre || ''}${d.aut_tel ? '\nTel. ' + d.aut_tel : ''}`;
const correoValido = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || '').trim());

return { SCHEMA_ID, SCHEMA_VER, KEYS, empty, normalize, esc, LPD, header, makeDoc, checkNIF, RX, validate, PROVINCIAS, MESES, GROUPS, SIG_KEYS, SIG_TITLES, issues,
  SOLTEC_DEFAULT, fillToday, copyAutToRf, nombrePdf, asuntoCorreo, cuerpoCorreo, correoValido };
});
