(function () {
  'use strict';

  const BUILD = 'V135-MODULOS-2-CREAR-PARTE';
  let appWindow = null;
  let current = null;
  let saveTimer = 0;
  let listObserver = null;

  const db = () => window.SoltecDB135;
  const doc = () => appWindow && appWindow.document;
  const el = id => doc() && doc().getElementById(id);
  const text = value => value == null ? '' : String(value);
  const esc = value => text(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const statusName = value => value === 'sent' ? 'ENVIADO' : value === 'signed' ? 'FIRMADO' : 'BORRADOR';

  function installCss() {
    if (el('partes135-css')) return;
    const link = doc().createElement('link');
    link.id = 'partes135-css';
    link.rel = 'stylesheet';
    link.href = './partes135.css?build=' + encodeURIComponent(BUILD);
    doc().head.appendChild(link);
  }

  function installScreen() {
    installCss();
    const old = el('partes') || el('partes135');
    if (old) old.remove();
    const section = doc().createElement('section');
    section.id = 'partes135';
    section.className = 'screen';
    section.innerHTML = '<div class="card"><div class="pt135-head"><h2>Partes de trabajo</h2><span class="pt135-version">V1.35</span></div>' +
      '<div class="pt135-tabs"><button type="button" id="pt135-new" class="active">➕ Crear parte</button><button type="button" id="pt135-list">🔎 Consultar partes</button></div>' +
      '<div id="pt135-editor"></div><div id="pt135-history" hidden></div></div>';
    doc().querySelector('main').appendChild(section);
    el('pt135-new').onclick = () => showTab('new');
    el('pt135-list').onclick = () => showTab('history');
  }

  function ensureNav() {
    const nav = doc().querySelector('nav.bottom');
    if (!nav) return;
    let button = el('navPartes');
    if (!button) {
      button = doc().createElement('button');
      button.id = 'navPartes';
      button.type = 'button';
      const finish = el('navFinalizar');
      nav.insertBefore(button, finish || null);
    }
    button.innerHTML = '🧾<br>Partes';
    button.onclick = show;
  }

  function activate() {
    doc().querySelectorAll('.screen').forEach(node => node.classList.remove('active'));
    el('partes135').classList.add('active');
    doc().querySelectorAll('nav.bottom button').forEach(node => node.classList.remove('active'));
    if (el('navPartes')) el('navPartes').classList.add('active');
    try { appWindow.scrollTo(0, 0); } catch (_) {}
  }

  function show() {
    if (!el('partes135')) installScreen();
    ensureNav();
    activate();
    showTab('new');
  }

  function showTab(tab) {
    const history = tab === 'history';
    el('pt135-editor').hidden = history;
    el('pt135-history').hidden = !history;
    el('pt135-new').classList.toggle('active', !history);
    el('pt135-list').classList.toggle('active', history);
    if (history) renderHistory(); else renderEditor();
  }

  function noticeSelector() {
    const options = db().notices().map(notice => '<option value="' + esc(notice.id) + '">' + esc(notice.id + ' · ' + (notice.cliente || 'Sin cliente')) + '</option>').join('');
    el('pt135-editor').innerHTML = '<div class="sectionTitle">Crear desde un aviso</div><label>Aviso / cliente<select id="pt135-notice"><option value="">Seleccionar…</option>' + options + '</select></label>' +
      '<button type="button" id="pt135-create" class="primary full">Crear parte de trabajo</button><p class="pt135-help">Los datos del cliente y del técnico se copian automáticamente. Avisos y Partes permanecen como módulos independientes.</p>';
    el('pt135-create').onclick = () => {
      const id = el('pt135-notice').value;
      if (!id) return appWindow.alert('Selecciona un aviso.');
      createFromNotice(id);
    };
  }

  function field(label, id, value, readonly, type) {
    return '<label>' + label + '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(value) + '" ' + (readonly ? 'readonly class="pt135-readonly"' : '') + '></label>';
  }

  function materialRow(row, index, locked) {
    return '<div class="pt135-material" data-material="' + index + '"><div class="pt135-material-grid">' +
      field('Cantidad', 'pt135-mqty-' + index, row.cantidad, locked) +
      field('Descripción', 'pt135-mdesc-' + index, row.descripcion, locked) +
      field('Referencia', 'pt135-mref-' + index, row.referencia, locked) +
      '</div><label>Observaciones<input id="pt135-mobs-' + index + '" value="' + esc(row.observaciones) + '" ' + (locked ? 'readonly class="pt135-readonly"' : '') + '></label>' +
      (locked ? '' : '<button type="button" class="danger" data-remove-material="' + index + '">Quitar material</button>') + '</div>';
  }

  function renderEditor() {
    if (!current) return noticeSelector();
    current = db().normalize(current);
    const locked = current.status !== 'draft';
    const materials = current.materiales.length ? current.materiales : [{ cantidad: '', descripcion: '', referencia: '', observaciones: '' }];
    el('pt135-editor').innerHTML = '<div class="pt135-summary"><strong>' + esc(current.partNo) + '</strong> <span class="pt135-badge ' + esc(current.status) + '">' + statusName(current.status) + '</span>' +
      '<div class="pt135-grid">' + field('Nº de aviso', 'pt135-aviso', current.avisoNo, true) + field('Fecha', 'pt135-fecha', current.fecha, locked, 'date') +
      field('Técnico', 'pt135-tecnico', current.tecnico, locked) + field('Cliente', 'pt135-cliente', current.cliente, locked) +
      '<div class="pt135-wide">' + field('Dirección', 'pt135-direccion', current.direccion, locked) + '</div>' +
      field('Piso', 'pt135-piso', current.piso, locked) + field('Puerta', 'pt135-puerta', current.puerta, locked) +
      field('Contacto', 'pt135-contacto', current.contacto, locked) + field('NIF/CIF', 'pt135-nif-cliente', current.nif, locked) +
      field('Teléfono', 'pt135-telefono', current.telefono, locked, 'tel') + field('Email', 'pt135-email', current.email, locked, 'email') +
      field('CP', 'pt135-cp', current.cp, locked) + field('Localidad', 'pt135-localidad', current.localidad, locked) +
      '<div class="pt135-wide">' + field('Provincia', 'pt135-provincia', current.provincia, locked) + '</div></div></div>' +
      '<label>Trabajos realizados<textarea id="pt135-trabajos" rows="10" ' + (locked ? 'readonly class="pt135-readonly"' : '') + '>' + esc(current.trabajos) + '</textarea></label>' +
      '<div class="sectionTitle">Conceptos</div><div class="pt135-concepts">' +
      check('Desplazamiento', 'desplazamiento', current.conceptos.desplazamiento, locked) + check('Disponibilidad', 'disponibilidad', current.conceptos.disponibilidad, locked) + check('Urgencia', 'urgencia', current.conceptos.urgencia, locked) + '</div>' +
      field('Mano de obra · horas manuales (ej.: 1,5 o 3,25)', 'pt135-horas', current.manoObraHoras, locked, 'text') +
      '<div class="sectionTitle">Material empleado (opcional)</div><div id="pt135-materials">' + materials.map((row, index) => materialRow(row, index, locked)).join('') + '</div>' +
      (locked ? '' : '<button type="button" id="pt135-add-material">＋ Añadir material</button>') +
      '<label>Observaciones<textarea id="pt135-observaciones" ' + (locked ? 'readonly class="pt135-readonly"' : '') + '>' + esc(current.observaciones) + '</textarea></label>' +
      '<label>Resultado<select id="pt135-resultado" ' + (locked ? 'disabled' : '') + '><option value="">Seleccionar…</option>' + ['Resuelto', 'Pendiente', 'Nueva visita', 'Requiere presupuesto'].map(value => '<option ' + (current.resultado === value ? 'selected' : '') + '>' + value + '</option>').join('') + '</select></label>' +
      '<div class="sectionTitle">Firma del cliente</div>' + field('Nombre de quien firma', 'pt135-firmante', current.firmante, locked) + field('DNI/NIF opcional', 'pt135-firmante-nif', current.firmanteNif, locked) +
      '<canvas id="pt135-sign-client" class="pt135-signature" aria-label="Firma del cliente" aria-disabled="' + locked + '"></canvas>' + (locked ? '' : '<div class="pt135-sign-tools"><button type="button" id="pt135-clear-client">Limpiar firma</button></div>') +
      '<div class="sectionTitle">Firma del técnico (opcional)</div><canvas id="pt135-sign-tech" class="pt135-signature" aria-label="Firma del técnico" aria-disabled="' + locked + '"></canvas>' + (locked ? '' : '<div class="pt135-sign-tools"><button type="button" id="pt135-clear-tech">Limpiar firma</button></div>') +
      (current.signedAt ? '<p class="pt135-help"><b>Fecha y hora de firma:</b> ' + esc(new Date(current.signedAt).toLocaleString('es-ES')) + '</p>' : '') +
      '<div id="pt135-save-state" class="pt135-save">' + (locked ? 'Parte cerrado y protegido contra cambios.' : 'Guardado automático activo.') + '</div>' +
      (locked ? shareButtons() : '<div class="pt135-actions"><button type="button" id="pt135-close">Guardar y cerrar</button><button type="button" id="pt135-finalize" class="primary">Finalizar parte · PDF · Compartir</button></div>');
    bindEditor(locked);
  }

  function check(label, key, checked, locked) {
    return '<label class="pt135-check"><input type="checkbox" data-concept="' + key + '" ' + (checked ? 'checked' : '') + ' ' + (locked ? 'disabled' : '') + '> ' + label + '</label>';
  }

  function shareButtons() {
    return '<div class="pt135-share"><button type="button" id="pt135-share">Compartir PDF</button><button type="button" id="pt135-download">Descargar PDF</button><button type="button" id="pt135-email">Correo con PDF</button><button type="button" id="pt135-preview">Ver PDF</button></div><p class="pt135-help">En móvil y tablet, “Compartir PDF” entrega el archivo real a WhatsApp, Gmail, Drive y las demás apps disponibles.</p><div class="pt135-actions"><button type="button" id="pt135-back">Consultar partes</button><button type="button" id="pt135-another">Crear otro parte</button></div>';
  }

  function readForm() {
    if (!current) return null;
    const read = id => el(id) ? el(id).value : '';
    current.fecha = read('pt135-fecha'); current.tecnico = read('pt135-tecnico'); current.cliente = read('pt135-cliente');
    current.direccion = read('pt135-direccion'); current.piso = read('pt135-piso'); current.puerta = read('pt135-puerta'); current.contacto = read('pt135-contacto'); current.nif = read('pt135-nif-cliente');
    current.telefono = read('pt135-telefono'); current.email = read('pt135-email'); current.cp = read('pt135-cp');
    current.localidad = read('pt135-localidad'); current.provincia = read('pt135-provincia'); current.trabajos = read('pt135-trabajos');
    current.manoObraHoras = read('pt135-horas'); current.observaciones = read('pt135-observaciones'); current.resultado = read('pt135-resultado');
    current.firmante = read('pt135-firmante'); current.firmanteNif = read('pt135-firmante-nif');
    current.conceptos = { desplazamiento: false, disponibilidad: false, urgencia: false };
    doc().querySelectorAll('[data-concept]').forEach(input => current.conceptos[input.dataset.concept] = input.checked);
    current.materiales = Array.from(doc().querySelectorAll('[data-material]')).map(node => {
      const index = node.dataset.material;
      return { cantidad: read('pt135-mqty-' + index), descripcion: read('pt135-mdesc-' + index), referencia: read('pt135-mref-' + index), observaciones: read('pt135-mobs-' + index) };
    }).filter(row => Object.values(row).some(value => text(value).trim()));
    return db().normalize(current);
  }

  function autoSave() {
    if (!current || current.status !== 'draft') return;
    clearTimeout(saveTimer);
    saveTimer = appWindow.setTimeout(() => {
      current = db().save(readForm());
      if (el('pt135-save-state')) el('pt135-save-state').textContent = 'Guardado ' + new Date().toLocaleTimeString('es-ES');
    }, 350);
  }

  function bindEditor(locked) {
    drawSignature('pt135-sign-client', 'firmaCliente', current.firmaCliente, locked);
    drawSignature('pt135-sign-tech', 'firmaTecnico', current.firmaTecnico, locked);
    if (locked) {
      el('pt135-share').onclick = () => shareCurrent();
      el('pt135-download').onclick = () => window.SoltecPartesPdf135.download(current);
      el('pt135-email').onclick = () => window.SoltecPartesPdf135.emailFile(current);
      el('pt135-preview').onclick = () => window.SoltecPartesPdf135.preview(current);
      el('pt135-back').onclick = () => showTab('history');
      el('pt135-another').onclick = () => { current = null; showTab('new'); };
      return;
    }
    el('pt135-editor').querySelectorAll('input,textarea,select').forEach(input => input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', autoSave));
    el('pt135-add-material').onclick = () => { current = readForm(); current.materiales.push({ cantidad: '', descripcion: '', referencia: '', observaciones: '' }); renderEditor(); };
    doc().querySelectorAll('[data-remove-material]').forEach(button => button.onclick = () => { current = readForm(); current.materiales.splice(Number(button.dataset.removeMaterial), 1); current = db().save(current); renderEditor(); });
    el('pt135-clear-client').onclick = () => { current.firmaCliente = ''; renderEditor(); autoSave(); };
    el('pt135-clear-tech').onclick = () => { current.firmaTecnico = ''; renderEditor(); autoSave(); };
    el('pt135-close').onclick = () => { current = db().save(readForm()); current = null; showTab('history'); };
    el('pt135-finalize').onclick = finalize;
  }

  function drawSignature(id, property, dataUrl, locked) {
    const canvas = el(id);
    const ratio = Math.max(1, appWindow.devicePixelRatio || 1);
    const width = Math.max(300, Math.round(canvas.clientWidth || 600));
    const height = 180;
    canvas.width = width * ratio; canvas.height = height * ratio;
    const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      const image = new appWindow.Image(); image.onload = () => ctx.drawImage(image, 0, 0, width, height); image.src = dataUrl;
    }
    if (locked) return;
    let drawing = false;
    const point = event => { const rect = canvas.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top]; };
    canvas.onpointerdown = event => { event.preventDefault(); drawing = true; canvas.setPointerCapture(event.pointerId); const [x, y] = point(event); ctx.beginPath(); ctx.moveTo(x, y); };
    canvas.onpointermove = event => { if (!drawing) return; event.preventDefault(); const [x, y] = point(event); ctx.lineTo(x, y); ctx.stroke(); };
    const finish = event => { if (!drawing) return; drawing = false; try { canvas.releasePointerCapture(event.pointerId); } catch (_) {} current[property] = canvas.toDataURL('image/png'); autoSave(); };
    canvas.onpointerup = finish; canvas.onpointercancel = finish;
  }

  async function finalize() {
    current = readForm();
    if (!current.trabajos.trim()) return appWindow.alert('Falta describir los trabajos realizados.');
    if (!current.manoObraHoras.trim()) return appWindow.alert('Introduce manualmente las horas de mano de obra.');
    if (!/^\d+(?:[,.]\d+)?$/.test(current.manoObraHoras.trim())) return appWindow.alert('Las horas deben tener formato 1, 1,5, 2 o 3,25.');
    if (!current.resultado) return appWindow.alert('Selecciona el resultado del trabajo.');
    if (!current.firmante.trim()) return appWindow.alert('Falta el nombre de quien firma.');
    if (!current.firmaCliente) return appWindow.alert('Falta la firma del cliente.');
    current.status = 'signed'; current.locked = true; current.signedAt = new Date().toISOString();
    current = db().save(current); renderEditor();
    await shareCurrent(true);
  }

  async function shareCurrent(fromFinalize) {
    try {
      const result = await window.SoltecPartesPdf135.share(current);
      if (result.shared) {
        current.sentAt = new Date().toISOString(); current.sentVia = 'Compartir nativo'; current.status = 'sent'; current = db().save(current); renderEditor();
      } else if (fromFinalize) {
        appWindow.alert('El PDF se ha creado. Este dispositivo no permite compartir archivos desde el navegador; se descargará para poder adjuntarlo.');
        await window.SoltecPartesPdf135.download(current);
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      appWindow.alert('No se pudo compartir el PDF: ' + text(error && error.message || error));
    }
  }

  function renderHistory() {
    const box = el('pt135-history');
    const query = text(el('pt135-search') && el('pt135-search').value).toLowerCase().trim();
    const rows = db().parts().filter(part => !query || [part.partNo, part.avisoNo, part.cliente, part.tecnico, part.resultado].join(' ').toLowerCase().includes(query));
    box.innerHTML = '<div class="sectionTitle">Histórico de partes</div><input id="pt135-search" type="search" placeholder="Buscar por parte, aviso, cliente o técnico" value="' + esc(query) + '"><div class="counter">' + rows.length + ' parte(s)</div>' +
      (rows.length ? rows.map(part => '<div class="pt135-history"><div class="pt135-history-top"><div><strong>' + esc(part.partNo) + '</strong><div class="pt135-help">Aviso ' + esc(part.avisoNo) + ' · ' + esc(part.cliente) + '</div></div><span class="pt135-badge ' + esc(part.status) + '">' + statusName(part.status) + '</span></div><div class="pt135-actions"><button type="button" data-open-part="' + esc(part.id) + '">Abrir</button><button type="button" data-new-part="' + esc(part.avisoId) + '">Nuevo desde este aviso</button></div></div>').join('') : '<div class="pt135-empty">Todavía no hay partes.</div>');
    el('pt135-search').oninput = renderHistory;
    box.querySelectorAll('[data-open-part]').forEach(button => button.onclick = () => { current = db().partById(button.dataset.openPart); showTab('new'); });
    box.querySelectorAll('[data-new-part]').forEach(button => button.onclick = () => createFromNotice(button.dataset.newPart));
  }

  function createFromNotice(id) {
    try {
      const noticeId = text(id).trim();
      if (!noticeId) throw new Error('El aviso no tiene un identificador válido.');
      const created = db().createFromNotice(noticeId);
      const stored = db().partById(created.id);
      if (!stored) throw new Error('El parte no se ha podido guardar en la base de datos.');
      current = stored;
      if (!el('partes135')) installScreen();
      ensureNav();
      activate();
      showTab('new');
      return stored;
    } catch (error) {
      console.error('CREAR PARTE DESDE AVISO', error);
      if (appWindow) appWindow.alert('No se pudo crear el parte: ' + text(error && error.message || error));
      return null;
    }
  }

  function injectNoticeButtons() {
    if (!appWindow) return;
    doc().querySelectorAll('#listaAvisos .avisoCard').forEach(card => {
      if (card.querySelector('.ptCreateFromAviso')) return;
      const actions = card.querySelector('.actions');
      if (!actions) return;
      let id = '';
      actions.querySelectorAll('button').forEach(button => {
        const match = text(button.getAttribute('onclick')).match(/(?:editarAviso|duplicarAviso|eliminarAviso)\(([^)]+)\)/);
        if (match) id = match[1].replace(/["']/g, '');
      });
      if (!id) return;
      card.dataset.soltecAvisoId = id;
      const button = doc().createElement('button');
      button.type = 'button';
      button.className = 'ptCreateFromAviso';
      button.dataset.soltecAvisoId = id;
      button.textContent = '🧾 Crear parte de trabajo';
      button.onclick = event => {
        event.preventDefault();
        event.stopPropagation();
        createFromNotice(button.dataset.soltecAvisoId);
      };
      actions.appendChild(button);
    });
  }

  function hookAvisos() {
    const list = el('listaAvisos');
    if (list && !listObserver) { listObserver = new MutationObserver(injectNoticeButtons); listObserver.observe(list, { childList: true, subtree: true }); }
    injectNoticeButtons();
    if (appWindow.App && !appWindow.App.__partes135) {
      const original = appWindow.App.show;
      appWindow.App.show = function (screen) { const result = original.apply(this, arguments); setTimeout(injectNoticeButtons, 20); if (screen === 'partes' || screen === 'partes135') show(); return result; };
      appWindow.App.crearParteDesdeAviso = createFromNotice;
      appWindow.App.__partes135 = true;
    }
    appWindow.SoltecPartes135 = { createFromNotice, show };
  }

  function init(win) {
    appWindow = win;
    db().init(win);
    if (!el('partes135')) installScreen();
    ensureNav(); hookAvisos(); noticeSelector(); renderHistory();
    appWindow.setInterval(() => { ensureNav(); injectNoticeButtons(); }, 2500);
  }

  window.SoltecPartes135 = { init, show, createFromNotice, version: BUILD };
})();
