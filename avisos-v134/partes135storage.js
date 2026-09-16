(function () {
  'use strict';

  const BUILD = 'V135-MODULOS-2-CREAR-PARTE';
  const MAIN_KEY = 'APP_AVISOS_WEB_DATOS_V116_PERSISTENTE';
  const PARTS_KEY = 'APP_AVISOS_PARTES_V134';
  const VERSION_KEY = 'APP_AVISOS_VERSIONLOG_V135';
  const PENDING_KEY = 'SOLTEC_SYNC_PENDING_V134';
  let appWindow = null;

  const text = value => value == null ? '' : String(value);
  const parse = (value, fallback) => {
    try {
      const parsed = JSON.parse(value || '');
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  };
  const now = () => new Date().toISOString();
  const today = () => now().slice(0, 10);
  const clone = value => JSON.parse(JSON.stringify(value));

  function storage() {
    if (!appWindow) throw new Error('La base de datos de SOLTEC no está iniciada.');
    return appWindow.localStorage;
  }

  function main() {
    return parse(storage().getItem(MAIN_KEY), {
      empresa: {}, tecnico: {}, solicitante: {}, avisos: [], papelera: []
    });
  }

  function notices() {
    const rows = main().avisos;
    return (Array.isArray(rows) ? rows : []).slice().sort((a, b) =>
      text(b.fecha || b.actualizado).localeCompare(text(a.fecha || a.actualizado)) ||
      Number(b.id || 0) - Number(a.id || 0)
    );
  }

  function normalizeMaterials(part) {
    let rows = Array.isArray(part.materiales) ? part.materiales : [];
    if (!rows.length && text(part.material || part.materialesTexto).trim()) {
      rows = [{ cantidad: '', descripcion: part.material || part.materialesTexto, referencia: '', observaciones: '' }];
    }
    return rows.map(row => ({
      cantidad: text(row.cantidad || row.qty),
      descripcion: text(row.descripcion || row.description),
      referencia: text(row.referencia || row.reference),
      observaciones: text(row.observaciones || row.note)
    }));
  }

  function normalize(part) {
    part = part || {};
    const status = ['signed', 'sent'].includes(part.status) ? part.status : 'draft';
    return {
      schema: 'PARTES_V3',
      build: BUILD,
      id: text(part.id) || ('PT-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
      partNo: text(part.partNo || part.numero),
      avisoId: text(part.avisoId || part.avisoNo),
      avisoNo: text(part.avisoNo || part.avisoId),
      fecha: text(part.fecha) || today(),
      tecnico: text(part.tecnico),
      cliente: text(part.cliente),
      direccion: text(part.direccion),
      contacto: text(part.contacto),
      nif: text(part.nifCliente || part.clienteNif || (part.schema === 'PARTES_V3' ? part.nif : '')),
      telefono: text(part.telefono),
      email: text(part.email),
      cp: text(part.cp),
      localidad: text(part.localidad),
      provincia: text(part.provincia),
      trabajos: text(part.trabajos),
      conceptos: {
        desplazamiento: !!(part.conceptos && part.conceptos.desplazamiento),
        disponibilidad: !!(part.conceptos && part.conceptos.disponibilidad),
        urgencia: !!(part.conceptos && part.conceptos.urgencia)
      },
      manoObraHoras: text(part.manoObraHoras || part.horas),
      materiales: normalizeMaterials(part),
      observaciones: text(part.observaciones || part.notasInternas),
      resultado: text(part.resultado),
      firmante: text(part.firmante || part.signerName),
      firmanteNif: text(part.firmanteNif || part.signerNif || (part.schema !== 'PARTES_V3' ? part.nif : '')),
      firmaCliente: text(part.firmaCliente || part.signatureData || part.firma),
      firmaTecnico: text(part.firmaTecnico || part.techSignatureData || part.firmaTec),
      signedAt: text(part.signedAt),
      sentAt: text(part.sentAt),
      sentVia: text(part.sentVia),
      status,
      locked: status !== 'draft' || !!part.locked,
      createdAt: text(part.createdAt) || now(),
      updatedAt: text(part.updatedAt) || now()
    };
  }

  function parts() {
    const raw = parse(storage().getItem(PARTS_KEY), []);
    const rows = Array.isArray(raw) ? raw : (Array.isArray(raw.parts) ? raw.parts : []);
    return rows.map(normalize).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function nextPartNo() {
    const year = String(new Date().getFullYear());
    let max = 0;
    parts().forEach(part => {
      const match = part.partNo.match(/^PT-(\d{4})-(\d+)/);
      if (match && match[1] === year) max = Math.max(max, Number(match[2]) || 0);
    });
    return 'PT-' + year + '-' + String(max + 1).padStart(5, '0');
  }

  function markChanged() {
    storage().setItem(PENDING_KEY, '1');
    const detail = { module: 'partes', at: now() };
    try { appWindow.dispatchEvent(new CustomEvent('soltec:datachange', { detail })); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('soltec:datachange', { detail })); } catch (_) {}
  }

  function writeVersion() {
    const log = parse(storage().getItem(VERSION_KEY), []);
    const rows = Array.isArray(log) ? log : [];
    if (!rows.some(item => item && item.build === BUILD)) {
      rows.unshift({ build: BUILD, module: 'Partes de trabajo', dataSchema: 'PARTES_V3', at: now(), note: 'Módulos separados con base y sincronización comunes' });
      storage().setItem(VERSION_KEY, JSON.stringify(rows.slice(0, 50)));
    }
  }

  function save(part) {
    const clean = normalize(part);
    clean.updatedAt = now();
    const rows = parts();
    const index = rows.findIndex(item => item.id === clean.id);
    if (index < 0) rows.unshift(clean); else rows[index] = clean;
    storage().setItem(PARTS_KEY, JSON.stringify(rows));
    writeVersion();
    markChanged();
    return clone(clean);
  }

  function createFromNotice(id) {
    const notice = notices().find(item => text(item.id) === text(id));
    if (!notice) throw new Error('No se encuentra el aviso seleccionado.');
    const data = main();
    return save({
      partNo: nextPartNo(),
      avisoId: notice.id,
      avisoNo: notice.id,
      fecha: notice.fecha || today(),
      tecnico: text(data.tecnico && data.tecnico.nombre),
      cliente: notice.cliente,
      direccion: notice.direccion,
      contacto: notice.contacto,
      nifCliente: notice.nif,
      telefono: notice.telefono,
      email: notice.email,
      cp: notice.cp,
      localidad: notice.localidad,
      provincia: notice.provincia,
      trabajos: '',
      conceptos: {},
      manoObraHoras: '',
      materiales: [],
      observaciones: '',
      resultado: '',
      status: 'draft'
    });
  }

  function init(win) {
    appWindow = win;
    writeVersion();
    return api;
  }

  const api = {
    BUILD, MAIN_KEY, PARTS_KEY, PENDING_KEY,
    init, main, notices, parts, normalize, save, createFromNotice, nextPartNo,
    noticeById: id => notices().find(item => text(item.id) === text(id)) || null,
    partById: id => parts().find(item => item.id === id) || null,
    markChanged,
    window: () => appWindow
  };

  window.SoltecDB135 = api;
})();
