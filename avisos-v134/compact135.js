(function () {
  'use strict';

  const MAIN = 'APP_AVISOS_WEB_DATOS_V116_PERSISTENTE';
  const PLACES = 'APP_AVISOS_DIRECCIONES_V135';
  let appWindow = null;

  const text = value => value == null ? '' : String(value).trim();
  const el = (d, id) => d.getElementById(id);
  const parse = (value, fallback) => { try { return JSON.parse(value || '') || fallback; } catch (_) { return fallback; } };
  const esc = value => text(value).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  function formEditing(d) {
    const active = d.activeElement;
    return !!(active && active.closest && active.closest('#formAviso') && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
  }

  function main() {
    return parse(appWindow.localStorage.getItem(MAIN), { avisos: [] });
  }

  function noticeId(d) {
    return Number((el(d, 'avId') || {}).value) || 0;
  }

  function style(d) {
    if (el(d, 'compact135Style')) return;
    const sheet = d.createElement('style'); sheet.id = 'compact135Style';
    sheet.textContent = `
      #navAvisos,#navPartes,#navExp132,#navMem132,#navPhotos133{display:none!important}
      nav.bottom{display:flex!important;flex-wrap:nowrap!important;grid-template-columns:none!important}
      nav.bottom>button{flex:1 1 0!important;min-width:0!important;max-width:none!important;font-size:12px!important;padding-left:2px!important;padding-right:2px!important}
      .c135-home{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}
      .c135-home button{min-height:82px;border:1px solid #f0b7b2;background:#fff7f6;color:#8f1d16;border-radius:14px;font-size:16px;font-weight:900}
      .c135-home button span{display:block;font-size:11px;font-weight:600;color:#667085;margin-top:5px}
      .c135-tab{grid-column:1/-1;border:1px solid #dbe3ee;border-radius:13px;background:#f8fafc;margin:7px 0;overflow:hidden}
      .c135-tab>summary{cursor:pointer;list-style:none;padding:12px;font-weight:900;color:#24466e}
      .c135-tab>summary::-webkit-details-marker{display:none}.c135-tab>summary:after{content:'▾';float:right;color:#e7281c}
      .c135-tab[open]>summary:after{content:'▴'}.c135-tab-body{padding:0 10px 10px}
      .c135-place-grid{display:grid;grid-template-columns:.55fr 1fr 1fr;gap:8px;grid-column:1/-1}
      .c135-context{font-size:12px;font-weight:800;color:#667085;margin:0 0 10px}
      .c135-back{margin-bottom:10px}.c135-hidden-label{display:none!important}
      #formAviso{padding:10px}
      #formAviso .c135-form-details>summary{cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#24466e}
      #formAviso .c135-form-details>summary::-webkit-details-marker{display:none}
      #formAviso .c135-form-details>summary:after{content:'▾';color:#e7281c;font-size:18px}
      #formAviso .c135-form-details[open]>summary:after{content:'▴'}
      #formAviso .c135-form-details>summary h3{margin:2px 0;font-size:16px}
      #formAviso .grid2{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 8px}
      #formAviso .grid2>.wide,#formAviso .grid2>.sectionTitle,#formAviso .grid2>.c135-tab,#formAviso .grid2>.c135-place-grid{grid-column:1/-1}
      #formAviso .grid2>label.wide{grid-column:auto}
      #formAviso .grid2>label:has(#avCliente,#avDireccion,#avRefCatastral,#avEmail,#s132Iban,#avCupsE,#avCupsG,#avConcepto,#avObservaciones){grid-column:1/-1}
      #formAviso label{min-width:0;margin:1px 0;line-height:1.25}
      #formAviso input:not([type=checkbox]):not([type=file]),#formAviso select{box-sizing:border-box;width:100%;min-width:0;height:36px;margin-top:3px;padding:6px 8px;border-radius:8px;font-size:16px}
      #formAviso textarea{box-sizing:border-box;min-height:72px;margin-top:3px;padding:7px 8px;border-radius:8px;font-size:16px}
      #formAviso .sectionTitle{margin:7px 0 5px;padding-bottom:4px}
      #formAviso .c135-tab>summary{padding:9px 10px}
      #formAviso .c135-tab-body{padding:0 8px 8px}
      #formAviso .c135-find-cp{min-width:0;display:flex;align-items:flex-end}
      #formAviso .c135-find-cp button{width:100%;min-height:36px;margin:0!important;padding:5px 7px;font-size:12px;line-height:1.15}
      #s133PhotoShort{margin:7px 0!important}#av135MemoryTab button,#s133PhotoShort button{width:100%}
      @media(max-width:620px){.c135-place-grid{grid-template-columns:1fr}.c135-home{grid-template-columns:1fr 1fr}.c135-home button{min-height:70px;font-size:14px}}
    `;
    d.head.appendChild(sheet);
  }

  function home(d) {
    const card = d.querySelector('#inicio .card'); if (!card) return;
    let box = el(d, 'c135Home');
    if (!box) {
      box = d.createElement('div'); box.id = 'c135Home'; box.className = 'c135-home';
      box.innerHTML = '<button type="button" id="c135GoAvisos">☰ AVISOS<span>Crear y consultar avisos</span></button><button type="button" id="c135GoPartes">🧾 PARTES<span>Crear y consultar partes</span></button><button type="button" id="c135GoExp">▦ EXPEDIENTES<span>Historial por suministro</span></button><button type="button" id="c135GoEmpresa">⚙ EMPRESA<span>Configuración general</span></button>';
      const summary = el(d, 'resumenInicio'); summary ? summary.insertAdjacentElement('afterend', box) : card.appendChild(box);
      el(d, 'c135GoAvisos').onclick = () => appWindow.App.show('avisos');
      el(d, 'c135GoPartes').onclick = () => window.SoltecPartes135 && window.SoltecPartes135.show();
      el(d, 'c135GoExp').onclick = () => appWindow.App.show('exp132');
      el(d, 'c135GoEmpresa').onclick = () => appWindow.App.show('config');
    }
  }

  function detailsFrom(d, node, id, title) {
    if (!node) return null;
    if (node.tagName && node.tagName.toLowerCase() === 'details') return node;
    const details = d.createElement('details'); details.id = id; details.className = 'c135-tab';
    const summary = d.createElement('summary'); summary.textContent = title; details.appendChild(summary);
    const body = d.createElement('div'); body.className = 'c135-tab-body';
    while (node.firstChild) body.appendChild(node.firstChild);
    details.appendChild(body); node.replaceWith(details); return details;
  }

  function compactGroups(d) {
    const extra = el(d, 's132Extra');
    if (extra && extra.tagName.toLowerCase() !== 'details') {
      const det = detailsFrom(d, extra, 's132Extra', '➕ Datos adicionales del suministro');
      const title = det && det.querySelector('.sectionTitle'); if (title) title.style.display = 'none';
    }
    const mail = el(d, 'av135Solicitudes');
    if (mail && mail.tagName.toLowerCase() !== 'details') {
      const det = detailsFrom(d, mail, 'av135Solicitudes', '✉ Solicitudes y correos');
      const title = det && det.querySelector('.sectionTitle'); if (title) title.style.display = 'none';
    }
    groupSection(d, 'c135Electrical', /DATOS ELÉCTRICOS/i, /DATOS DEL AVISO/i, '⚡ Datos eléctricos');
    groupSection(d, 'c135NoticeData', /DATOS DEL AVISO/i, null, '📝 Datos y observaciones del aviso');
  }

  function groupSection(d, id, startPattern, endPattern, title) {
    if (el(d, id)) return;
    const grid = d.querySelector('#formAviso .grid2'); if (!grid) return;
    const sections = Array.from(grid.querySelectorAll('.sectionTitle'));
    const start = sections.find(node => startPattern.test(node.textContent || '')); if (!start || start.parentNode !== grid) return;
    const end = endPattern ? sections.find(node => endPattern.test(node.textContent || '') && node.parentNode === grid) : null;
    const details = d.createElement('details'); details.id = id; details.className = 'c135-tab';
    const summary = d.createElement('summary'); summary.textContent = title; details.appendChild(summary);
    const body = d.createElement('div'); body.className = 'c135-tab-body grid2'; details.appendChild(body);
    grid.insertBefore(details, start);
    let node = start;
    while (node && node !== end) { const next = node.nextSibling; body.appendChild(node); node = next; }
    start.style.display = 'none';
  }

  function compactFields(d) {
    ['avCliente', 'avContacto', 'avNif', 'avTelefono', 'avEmail', 'avPiso', 'avPuerta', 'avCp', 'avLocalidad', 'avProvincia'].forEach(id => {
      const label = (el(d, id) || {}).closest && el(d, id).closest('label'); if (label) label.classList.remove('wide');
    });
    ['avDireccion', 'avRefCatastral'].forEach(id => {
      const label = (el(d, id) || {}).closest && el(d, id).closest('label'); if (label) label.classList.add('wide');
    });
  }

  function addressFields(d) {
    const address = el(d, 'avDireccion');
    if (!address) return;
    const addressLabel = address.closest('label');
    if (!addressLabel) return;
    let floor = (el(d, 'avPiso') || {}).closest && el(d, 'avPiso').closest('label');
    let door = (el(d, 'avPuerta') || {}).closest && el(d, 'avPuerta').closest('label');
    if (!floor) { floor = d.createElement('label'); floor.innerHTML = 'Piso<input id="avPiso" autocomplete="address-line2" placeholder="Ej.: 2º">'; }
    if (!door) { door = d.createElement('label'); door.innerHTML = 'Puerta<input id="avPuerta" autocomplete="address-line3" placeholder="Ej.: B">'; }
    if (addressLabel.nextElementSibling !== floor) addressLabel.insertAdjacentElement('afterend', floor);
    if (floor.nextElementSibling !== door) floor.insertAdjacentElement('afterend', door);
  }

  function openMemory(d) {
    let id = noticeId(d);
    const form = el(d, 'formAviso');
    if (form && form.style.display !== 'none') {
      const before = new Set((main().avisos || []).map(item => Number(item.id)));
      appWindow.App.guardarAviso();
      if (form.style.display !== 'none') { appWindow.alert('NO SE HA PODIDO GUARDAR EL AVISO. REVISA LOS CAMPOS OBLIGATORIOS.'); return; }
      if (!id) {
        const created = (main().avisos || []).filter(item => !before.has(Number(item.id))).sort((a, b) => Number(b.id) - Number(a.id))[0];
        id = created ? Number(created.id) : 0;
      }
    }
    if (!id || !(main().avisos || []).some(item => Number(item.id) === id)) { appWindow.alert('GUARDA PRIMERO EL AVISO.'); return; }
    setTimeout(() => {
      appWindow.App.show('mem132');
      const selector = el(d, 's132MemSel'); if (selector) { selector.value = String(id); selector.dispatchEvent(new appWindow.Event('change', { bubbles: true })); }
      const context = el(d, 'c135MemContext'); if (context) context.textContent = 'Memoria del aviso ' + id;
    }, 80);
  }

  function contextualTabs(d) {
    const grid = d.querySelector('#formAviso .grid2'), plan = el(d, 's133PlanBox'); if (!grid || !plan) return;
    let photo = el(d, 's133PhotoShort');
    if (photo) {
      if (photo.tagName.toLowerCase() !== 'details') {
        photo = detailsFrom(d, photo, 's133PhotoShort', '📷 Fotografías del aviso');
        const oldTitle = photo && photo.querySelector('b'); if (oldTitle) oldTitle.style.display = 'none';
      }
      if (plan.nextElementSibling !== photo) plan.insertAdjacentElement('afterend', photo);
    }
    let memory = el(d, 'av135MemoryTab');
    if (!memory) {
      memory = d.createElement('details'); memory.id = 'av135MemoryTab'; memory.className = 'c135-tab';
      memory.innerHTML = '<summary>▤ CNMC Circular 1/2024 ENDESA</summary><div class="c135-tab-body"><p class="muted">El documento se genera directamente con los datos, el plano y las fotos de este aviso.</p><button type="button" class="primary" id="av135OpenMemory">ABRIR / GENERAR CNMC</button></div>';
      (photo || plan).insertAdjacentElement('afterend', memory);
      el(d, 'av135OpenMemory').onclick = () => openMemory(d);
    } else if (photo && memory.previousElementSibling !== photo) photo.insertAdjacentElement('afterend', memory);
  }

  function contextualScreens(d) {
    const photoSelect = el(d, 's133PhotoSel');
    if (photoSelect) {
      const label = photoSelect.closest('label'); if (label) label.classList.add('c135-hidden-label');
      const card = d.querySelector('#photos133 .card');
      if (card && !el(d, 'c135PhotoContext')) {
        const back = d.createElement('button'); back.id = 'c135PhotoBack'; back.type = 'button'; back.className = 'c135-back'; back.textContent = '← VOLVER AL AVISO'; back.onclick = () => appWindow.App.show('avisos'); card.insertBefore(back, card.firstChild);
        const p = d.createElement('p'); p.id = 'c135PhotoContext'; p.className = 'c135-context'; card.insertBefore(p, back.nextSibling);
      }
    }
    const memSelect = el(d, 's132MemSel');
    if (memSelect) {
      const label = memSelect.closest('label'); if (label) label.classList.add('c135-hidden-label');
      const card = d.querySelector('#mem132 .card');
      if (card && !el(d, 'c135MemContext')) {
        const back = d.createElement('button'); back.type = 'button'; back.className = 'c135-back'; back.textContent = '← VOLVER AL AVISO'; back.onclick = () => appWindow.App.show('avisos'); card.insertBefore(back, card.firstChild);
        const p = d.createElement('p'); p.id = 'c135MemContext'; p.className = 'c135-context'; card.insertBefore(p, back.nextSibling);
      }
    }
  }

  function openPhotosContext(d) {
    const id = noticeId(d); if (!id) return;
    const selector = el(d, 's133PhotoSel');
    if (selector) { selector.value = String(id); selector.dispatchEvent(new appWindow.Event('change', { bubbles: true })); }
    const context = el(d, 'c135PhotoContext'); if (context) context.textContent = 'Fotografías del aviso ' + id;
  }

  function hookPhotos(d) {
    const button = el(d, 's133OpenPhotos'); if (!button || button.dataset.c135) return;
    button.dataset.c135 = '1'; button.addEventListener('click', () => setTimeout(() => openPhotosContext(d), 0));
  }

  function placeRows() {
    const data = main(), saved = parse(appWindow.localStorage.getItem(PLACES), []), rows = [];
    (data.avisos || []).concat(Array.isArray(saved) ? saved : []).forEach(item => {
      const row = { cp: text(item.cp), localidad: text(item.localidad), provincia: text(item.provincia) };
      if ((row.cp || row.localidad || row.provincia) && !rows.some(x => x.cp === row.cp && x.localidad === row.localidad && x.provincia === row.provincia)) rows.push(row);
    });
    return rows;
  }

  function rememberPlace(row) {
    const rows = placeRows(), clean = { cp: text(row.cp), localidad: text(row.localidad), provincia: text(row.provincia) };
    if (!clean.cp && !clean.localidad && !clean.provincia) return;
    const next = [clean].concat(rows.filter(x => !(x.cp === clean.cp && x.localidad === clean.localidad && x.provincia === clean.provincia))).slice(0, 250);
    appWindow.localStorage.setItem(PLACES, JSON.stringify(next));
  }

  function optionList(d, id, values) {
    let list = el(d, id); if (!list) { list = d.createElement('datalist'); list.id = id; d.body.appendChild(list); }
    list.innerHTML = Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')).map(v => '<option value="' + esc(v) + '"></option>').join('');
  }

  function refreshPlaces(d) {
    const rows = placeRows(), province = text((el(d, 'avProvincia') || {}).value), locality = text((el(d, 'avLocalidad') || {}).value);
    optionList(d, 'c135ProvinciaList', rows.map(x => x.provincia));
    optionList(d, 'c135LocalidadList', rows.filter(x => !province || x.provincia === province).map(x => x.localidad));
    optionList(d, 'c135CpList', rows.filter(x => (!province || x.provincia === province) && (!locality || x.localidad === locality)).map(x => x.cp));
  }

  function candidateValue(candidate, names) {
    const sources = [candidate, candidate && candidate.properties, candidate && candidate.address];
    for (const source of sources) if (source && typeof source === 'object') for (const name of names) if (text(source[name])) return text(source[name]);
    return '';
  }

  function postalValue(source) {
    const seen = new Set();
    function walk(value, key) {
      if (value == null) return '';
      if (typeof value !== 'object') {
        const raw = text(value), match = raw.match(/\b\d{5}\b/);
        return (/(postal|postcode|codigo.?postal|cod.?postal|\bcp\b)/i.test(key || '') && match) ? match[0] : '';
      }
      if (seen.has(value)) return '';
      seen.add(value);
      for (const name of Object.keys(value)) { const found = walk(value[name], name); if (found) return found; }
      return '';
    }
    return walk(source, '') || '';
  }

  function reverseJsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = '__soltecCp' + Date.now() + Math.random().toString(36).slice(2), script = appWindow.document.createElement('script');
      let finished = false;
      const cleanup = () => { if (finished) return; finished = true; clearTimeout(timer); try { delete appWindow[callback]; } catch (_) {} if (script.parentNode) script.parentNode.removeChild(script); };
      appWindow[callback] = result => { cleanup(); resolve(result); };
      script.onerror = () => { cleanup(); reject(new Error('CartoCiudad no disponible')); };
      script.src = url + '&callback=' + encodeURIComponent(callback) + '&_=' + Date.now();
      appWindow.document.head.appendChild(script);
      const timer = setTimeout(() => { cleanup(); reject(new Error('Tiempo agotado')); }, 7000);
    });
  }

  async function reversePostalCode(d, candidate) {
    const lat = text(candidateValue(candidate, ['lat', 'latitude', 'y']) || (el(d, 'avLatitud') || {}).value);
    const lon = text(candidateValue(candidate, ['lng', 'lon', 'longitude', 'x']) || (el(d, 'avLongitud') || {}).value);
    if (!lat || !lon || !appWindow.fetch) return '';
    const query = 'lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon);
    const urls = [
      'https://www.cartociudad.es/geocoder/api/geocoder/reverseGeocode?' + query,
      'https://www.cartociudad.es/services/api/geocoder/reverseGeocode?' + query
    ];
    for (const url of urls) {
      try {
        const response = await appWindow.fetch(url, { cache: 'no-store' });
        if (!response.ok) continue;
        const result = await response.json(), cp = postalValue(result);
        if (cp) return cp;
      } catch (_) {}
    }
    const jsonpUrls = [
      'https://www.cartociudad.es/geocoder/api/geocoder/reverseGeocodeJsonp?' + query,
      'https://www.cartociudad.es/geocoder/api/geocoder/reverseGeocode?' + query
    ];
    for (const url of jsonpUrls) {
      try { const result = await reverseJsonp(url), cp = postalValue(result); if (cp) return cp; } catch (_) {}
    }
    return '';
  }

  async function applyCandidate(d, candidate) {
    if (!candidate) return;
    const addressText = typeof candidate.address === 'string' ? candidate.address : text(candidate.name);
    let cp = candidateValue(candidate, ['postalCode', 'postcode', 'postal_code', 'codigoPostal', 'codPostal', 'cod_postal', 'cp']) || postalValue(candidate);
    if (!cp) { const match = addressText.match(/\b\d{5}\b/); if (match) cp = match[0]; }
    const state = el(d, 'cartoEstado');
    if (!cp) {
      if (state) state.textContent = 'Dirección localizada. Calculando código postal…';
      cp = await reversePostalCode(d, candidate);
    }
    const locality = candidateValue(candidate, ['city', 'locality', 'municipality', 'municipio', 'poblacion', 'town']);
    const province = candidateValue(candidate, ['province', 'provincia', 'state']);
    if (cp) el(d, 'avCp').value = cp;
    if (locality && !text(el(d, 'avLocalidad').value)) el(d, 'avLocalidad').value = locality;
    if (province && !text(el(d, 'avProvincia').value)) el(d, 'avProvincia').value = province;
    rememberPlace({ cp: el(d, 'avCp').value, localidad: el(d, 'avLocalidad').value, provincia: el(d, 'avProvincia').value });
    refreshPlaces(d);
    if (state) state.textContent = cp ? 'Dirección y código postal obtenidos.' : 'Dirección localizada. No se pudo obtener el código postal automáticamente; introdúcelo manualmente.';
  }

  function addressLearning(d) {
    const cp = el(d, 'avCp'), locality = el(d, 'avLocalidad'), province = el(d, 'avProvincia'); if (!cp || !locality || !province) return;
    cp.setAttribute('list', 'c135CpList'); locality.setAttribute('list', 'c135LocalidadList'); province.setAttribute('list', 'c135ProvinciaList');
    [cp, locality, province].forEach(input => {
      if (input.dataset.c135Place) return; input.dataset.c135Place = '1';
      input.addEventListener('change', () => { rememberPlace({ cp: cp.value, localidad: locality.value, provincia: province.value }); refreshPlaces(d); });
    });
    let button = el(d, 'c135FindCp');
    if (!button) {
      button = d.createElement('button'); button.id = 'c135FindCp'; button.type = 'button'; button.textContent = '📍 BUSCAR DIRECCIÓN Y CP'; button.style.marginTop = '6px';
      button.onclick = async () => {
        if (!text((el(d, 'avDireccion') || {}).value) || !text(locality.value) || !text(province.value)) { appWindow.alert('INDICA DIRECCIÓN, LOCALIDAD Y PROVINCIA.'); return; }
        const details = el(d, 'av135CartoDetails'); if (details) details.open = true;
        if (text((el(d, 'avLatitud') || {}).value) && text((el(d, 'avLongitud') || {}).value)) {
          const found = await reversePostalCode(d, null);
          if (found) { cp.value = found; rememberPlace({ cp: cp.value, localidad: locality.value, provincia: province.value }); refreshPlaces(d); const state = el(d, 'cartoEstado'); if (state) state.textContent = 'Código postal obtenido: ' + found; return; }
        }
        appWindow.App.buscarCartoDireccion();
        const state = el(d, 'cartoEstado'); if (state) state.textContent = 'Selecciona el resultado correcto para completar coordenadas y código postal.';
      };
      cp.insertAdjacentElement('afterend', button);
    }
    const findWrap = el(d, 'c135FindCpWrap');
    if (findWrap && button.parentElement !== findWrap) findWrap.appendChild(button);
    refreshPlaces(d);
  }

  function collapsibleForm(d) {
    const form = el(d, 'formAviso'); if (!form || el(d, 'c135FormDetails')) return;
    const details = d.createElement('details'); details.id = 'c135FormDetails'; details.className = 'c135-form-details';
    const summary = d.createElement('summary'); const title = el(d, 'formAvisoTitulo');
    if (title) summary.appendChild(title); else summary.textContent = 'Editar aviso';
    details.appendChild(summary);
    const body = d.createElement('div'); body.className = 'c135-form-body';
    while (form.firstChild) body.appendChild(form.firstChild);
    details.appendChild(body); form.appendChild(details);
    details.open = form.style.display !== 'none';
  }

  function hooks(d) {
    const App = appWindow.App; if (!App || App.__compact135) return;
    const choose = App.elegirCarto;
    App.elegirCarto = function (index) {
      const candidate = appWindow.cartoCandidates && appWindow.cartoCandidates[Number(index)];
      const result = choose.apply(this, arguments); setTimeout(() => applyCandidate(d, candidate).catch(() => {}), 0); return result;
    };
    const save = App.guardarAviso;
    App.guardarAviso = function () {
      const row = { cp: text((el(d, 'avCp') || {}).value), localidad: text((el(d, 'avLocalidad') || {}).value), provincia: text((el(d, 'avProvincia') || {}).value) };
      const result = save.apply(this, arguments); rememberPlace(row); refreshPlaces(d); return result;
    };
    ['nuevoAviso', 'editarAviso', 'duplicarAviso'].forEach(name => {
      if (!App[name]) return;
      const original = App[name];
      App[name] = function () {
        const details = el(d, 'c135FormDetails'); if (details) details.open = true;
        return original.apply(this, arguments);
      };
    });
    App.__compact135 = true;
  }

  function arrange(d) {
    if (formEditing(d)) return;
    style(d); home(d); collapsibleForm(d); addressFields(d); compactGroups(d); compactFields(d); contextualTabs(d); contextualScreens(d); hookPhotos(d); addressLearning(d); hooks(d);
  }

  function init(win) {
    appWindow = win; const d = win.document;
    arrange(d); setTimeout(() => arrange(d), 250); setTimeout(() => arrange(d), 900); setTimeout(() => arrange(d), 2200);
  }

  window.SoltecCompact135 = { init };
})();
