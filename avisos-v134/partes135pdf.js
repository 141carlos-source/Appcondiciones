(function () {
  'use strict';

  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const MARGIN = 48;
  const RED = '#e7281c';
  const INK = '#182033';
  const MUTED = '#667085';
  const LINE = '#d6dbe3';

  const text = value => value == null ? '' : String(value);
  const db = () => window.SoltecDB135;
  const appWindow = () => db().window();

  function canvasPage(height) {
    const canvas = appWindow().document.createElement('canvas');
    canvas.width = PAGE_W; canvas.height = height || PAGE_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.fillStyle = INK; ctx.textBaseline = 'top';
    return { canvas, ctx, y: MARGIN };
  }

  function font(ctx, size, bold) {
    ctx.font = (bold ? '700 ' : '400 ') + size + 'px Arial, sans-serif';
    ctx.fillStyle = INK;
  }

  function line(page, color) {
    page.ctx.strokeStyle = color || LINE; page.ctx.lineWidth = 2;
    page.ctx.beginPath(); page.ctx.moveTo(MARGIN, page.y); page.ctx.lineTo(PAGE_W - MARGIN, page.y); page.ctx.stroke(); page.y += 12;
  }

  function wrapped(ctx, value, x, y, maxWidth, lineHeight, maxLines) {
    const paragraphs = text(value).split(/\r?\n/); const lines = [];
    paragraphs.forEach(paragraph => {
      const words = paragraph.split(/\s+/).filter(Boolean); let current = '';
      if (!words.length) lines.push('');
      words.forEach(word => {
        const candidate = current ? current + ' ' + word : word;
        if (ctx.measureText(candidate).width > maxWidth && current) { lines.push(current); current = word; } else current = candidate;
      });
      if (current) lines.push(current);
    });
    const visible = maxLines ? lines.slice(0, maxLines) : lines;
    visible.forEach((row, index) => ctx.fillText(row, x, y + index * lineHeight));
    return Math.max(lineHeight, visible.length * lineHeight);
  }

  function heading(page, value) {
    page.y += 6; font(page.ctx, 20, true); page.ctx.fillStyle = RED; page.ctx.fillText(value, MARGIN, page.y); page.y += 29;
  }

  function labelValue(page, label, value, x, width) {
    font(page.ctx, 12, true); page.ctx.fillStyle = MUTED; page.ctx.fillText(label.toUpperCase(), x, page.y);
    font(page.ctx, 17, false); page.ctx.fillStyle = INK;
    const height = wrapped(page.ctx, value || '—', x, page.y + 17, width, 21, 3);
    return height + 21;
  }

  function loadImage(src) {
    return new Promise(resolve => {
      if (!src || !text(src).startsWith('data:image/')) return resolve(null);
      const image = new (appWindow().Image)(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = src;
    });
  }

  function fitImage(ctx, image, x, y, width, height) {
    if (!image) return;
    const scale = Math.min(width / image.width, height / image.height);
    const w = image.width * scale, h = image.height * scale;
    ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
  }

  async function singlePage(part, company) {
    const page = canvasPage(4200), ctx = page.ctx;
    const logo = await loadImage(company.logoData);
    if (logo) fitImage(ctx, logo, MARGIN, page.y, 165, 72);
    const companyX = logo ? 235 : MARGIN;
    font(ctx, 24, true); ctx.fillText(company.nombre || company.nombreComercial || 'M. A. SOLTEC SL', companyX, page.y);
    font(ctx, 13, false); ctx.fillStyle = MUTED;
    const companyLine = [company.nif && 'NIF/CIF ' + company.nif, company.telefono, company.email].filter(Boolean).join(' · ');
    wrapped(ctx, companyLine, companyX, page.y + 31, PAGE_W - companyX - MARGIN, 17, 2);
    const companyAddress = [company.direccion, [company.cp, company.localidad].filter(Boolean).join(' '), company.provincia].filter(Boolean).join(' · ');
    wrapped(ctx, companyAddress, companyX, page.y + 52, PAGE_W - companyX - MARGIN, 17, 2);
    page.y += 82; ctx.fillStyle = RED; ctx.fillRect(MARGIN, page.y, PAGE_W - MARGIN * 2, 5); page.y += 15;
    font(ctx, 31, true); ctx.fillStyle = INK; ctx.fillText('PARTE DE TRABAJO', MARGIN, page.y);
    font(ctx, 19, true); ctx.fillStyle = RED; ctx.textAlign = 'right'; ctx.fillText(part.partNo, PAGE_W - MARGIN, page.y + 6); ctx.textAlign = 'left'; page.y += 45;

    const gap = 24, col = (PAGE_W - MARGIN * 2 - gap) / 2;
    function pair(labelA, valueA, labelB, valueB) {
      const y = page.y, a = labelValue(page, labelA, valueA, MARGIN, col); page.y = y;
      const b = labelValue(page, labelB, valueB, MARGIN + col + gap, col); page.y = y + Math.max(a, b) + 4;
    }
    pair('Nº aviso', part.avisoNo, 'Fecha', formatDate(part.fecha));
    pair('Cliente', part.cliente, 'Técnico', part.tecnico);
    if (part.obra || part.presupuesto === 'SI') pair('Obra / denominación', part.obra || '—', 'Presupuesto', part.presupuesto === 'SI' ? ('Sí' + (part.presupuestoNumero ? ' · Nº ' + part.presupuestoNumero : '')) : 'No');
    page.y += labelValue(page, 'Dirección', [part.direccion, [part.piso && ('Piso ' + part.piso), part.puerta && ('Puerta ' + part.puerta)].filter(Boolean).join(' · '), [part.cp, part.localidad].filter(Boolean).join(' '), part.provincia].filter(Boolean).join(' · '), MARGIN, PAGE_W - MARGIN * 2) + 2;
    pair('Contacto', part.contacto, 'NIF/CIF', part.nif);
    pair('Teléfono', part.telefono, 'Email', part.email);
    line(page);

    heading(page, 'Trabajos realizados'); font(ctx, 16, false); ctx.fillStyle = INK;
    page.y += wrapped(ctx, part.trabajos || '—', MARGIN, page.y, PAGE_W - MARGIN * 2, 21) + 8;
    line(page);
    heading(page, 'Conceptos y mano de obra');
    const concepts = [part.conceptos.desplazamiento && 'Desplazamiento', part.conceptos.disponibilidad && 'Disponibilidad', part.conceptos.urgencia && 'Urgencia'].filter(Boolean);
    font(ctx, 16, false); ctx.fillStyle = INK; ctx.fillText(concepts.length ? concepts.join(' · ') : 'Sin conceptos adicionales', MARGIN, page.y);
    font(ctx, 17, true); ctx.textAlign = 'right'; ctx.fillText('Mano de obra: ' + text(part.manoObraHoras || '0') + ' horas', PAGE_W - MARGIN, page.y); ctx.textAlign = 'left'; page.y += 29;
    line(page);

    heading(page, 'Material empleado');
    const materials = part.materiales || [];
    if (!materials.length) { font(ctx, 15, false); ctx.fillText('No se ha indicado material.', MARGIN, page.y); page.y += 24; }
    materials.forEach((row, index) => {
      font(ctx, 15, true); ctx.fillStyle = INK;
      const title = (index + 1) + '. ' + (row.cantidad ? row.cantidad + ' x ' : '') + (row.descripcion || 'Material');
      page.y += wrapped(ctx, title, MARGIN, page.y, PAGE_W - MARGIN * 2, 19) + 2;
      const detail = [row.referencia && 'Ref. ' + row.referencia, row.observaciones].filter(Boolean).join(' · ');
      if (detail) { font(ctx, 13, false); ctx.fillStyle = MUTED; page.y += wrapped(ctx, detail, MARGIN + 18, page.y, PAGE_W - MARGIN * 2 - 18, 17) + 4; }
    });
    line(page);
    heading(page, 'Observaciones'); font(ctx, 15, false); ctx.fillStyle = INK;
    page.y += wrapped(ctx, part.observaciones || '—', MARGIN, page.y, PAGE_W - MARGIN * 2, 20) + 7;
    font(ctx, 14, true); ctx.fillStyle = MUTED; ctx.fillText('RESULTADO', MARGIN, page.y);
    font(ctx, 17, true); ctx.fillStyle = INK; ctx.fillText(part.resultado || '—', MARGIN + 105, page.y - 2); page.y += 27;
    line(page);

    heading(page, 'Firmas');
    const signClient = await loadImage(part.firmaCliente), signTech = await loadImage(part.firmaTecnico);
    const signCol = (PAGE_W - MARGIN * 2 - gap) / 2, top = page.y;
    font(ctx, 14, true); ctx.fillText('CLIENTE', MARGIN, top); ctx.fillText('TÉCNICO', MARGIN + signCol + gap, top);
    ctx.strokeStyle = LINE; ctx.strokeRect(MARGIN, top + 22, signCol, 125); ctx.strokeRect(MARGIN + signCol + gap, top + 22, signCol, 125);
    fitImage(ctx, signClient, MARGIN + 6, top + 28, signCol - 12, 113); fitImage(ctx, signTech, MARGIN + signCol + gap + 6, top + 28, signCol - 12, 113);
    font(ctx, 14, false); ctx.fillStyle = INK; ctx.fillText(part.firmante || '—', MARGIN, top + 155); ctx.fillText(part.tecnico || '—', MARGIN + signCol + gap, top + 155);
    font(ctx, 12, false); ctx.fillStyle = MUTED;
    ctx.fillText([part.firmanteNif && 'DNI/NIF ' + part.firmanteNif, part.signedAt && formatDateTime(part.signedAt)].filter(Boolean).join(' · '), MARGIN, top + 177);
    page.y = top + 200;

    const finalPage = canvasPage(), out = finalPage.ctx, outMargin = 34, footerTop = PAGE_H - 52;
    const contentWidth = PAGE_W - MARGIN * 2, contentHeight = page.y - MARGIN;
    const scale = Math.min(1, (PAGE_W - outMargin * 2) / contentWidth, (footerTop - outMargin - 10) / contentHeight);
    out.drawImage(page.canvas, MARGIN, MARGIN, contentWidth, contentHeight, outMargin, outMargin, contentWidth * scale, contentHeight * scale);
    out.strokeStyle = LINE; out.beginPath(); out.moveTo(outMargin, footerTop); out.lineTo(PAGE_W - outMargin, footerTop); out.stroke();
    font(out, 11, false); out.fillStyle = MUTED; out.fillText('M. A. SOLTEC SL · ' + part.partNo, outMargin, footerTop + 12);
    out.textAlign = 'right'; out.fillText('Página 1/1', PAGE_W - outMargin, footerTop + 12); out.textAlign = 'left';
    return finalPage.canvas;
  }

  function formatDate(value) {
    if (!value) return '';
    try { return new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString('es-ES'); } catch (_) { return value; }
  }

  function formatDateTime(value) {
    try { return new Date(value).toLocaleString('es-ES'); } catch (_) { return value; }
  }

  function dataUrlBytes(url) {
    const binary = appWindow().atob(url.split(',')[1]); const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function ascii(value) { return new TextEncoder().encode(value); }
  function join(chunks) { const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0), out = new Uint8Array(length); let offset = 0; chunks.forEach(chunk => { out.set(chunk, offset); offset += chunk.length; }); return out; }

  function pdfFromCanvases(canvases) {
    const images = canvases.map(canvas => dataUrlBytes(canvas.toDataURL('image/jpeg', 0.88)));
    const objectCount = 2 + images.length * 3; const objects = new Array(objectCount + 1);
    const pageRefs = images.map((_, index) => (3 + index * 3) + ' 0 R').join(' ');
    objects[1] = ascii('<< /Type /Catalog /Pages 2 0 R >>');
    objects[2] = ascii('<< /Type /Pages /Kids [' + pageRefs + '] /Count ' + images.length + ' >>');
    images.forEach((image, index) => {
      const pageRef = 3 + index * 3, imageRef = pageRef + 1, contentRef = pageRef + 2, imageName = 'Im' + (index + 1);
      objects[pageRef] = ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /' + imageName + ' ' + imageRef + ' 0 R >> >> /Contents ' + contentRef + ' 0 R >>');
      objects[imageRef] = join([ascii('<< /Type /XObject /Subtype /Image /Width ' + PAGE_W + ' /Height ' + PAGE_H + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + image.length + ' >>\nstream\n'), image, ascii('\nendstream')]);
      const command = 'q 595.28 0 0 841.89 0 0 cm /' + imageName + ' Do Q';
      objects[contentRef] = ascii('<< /Length ' + command.length + ' >>\nstream\n' + command + '\nendstream');
    });
    const chunks = [ascii('%PDF-1.4\n%SOLTEC\n')], offsets = new Array(objectCount + 1).fill(0); let offset = chunks[0].length;
    for (let i = 1; i <= objectCount; i++) { const chunk = join([ascii(i + ' 0 obj\n'), objects[i], ascii('\nendobj\n')]); offsets[i] = offset; chunks.push(chunk); offset += chunk.length; }
    const xref = offset; let table = 'xref\n0 ' + (objectCount + 1) + '\n0000000000 65535 f \n';
    for (let i = 1; i <= objectCount; i++) table += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    table += 'trailer\n<< /Size ' + (objectCount + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF'; chunks.push(ascii(table));
    return new Blob(chunks, { type: 'application/pdf' });
  }

  function obraPresupuesto(part) {
    const win = appWindow(), ls = win && win.localStorage;
    let obra = '', presupuesto = 'NO', numero = '';
    if (!ls) return { obra, presupuesto, numero };
    try {
      const x = JSON.parse(ls.getItem('APP_AVISOS_PARTES_OBRAS_V135') || 'null') || {};
      const byPart = x.byPart && typeof x.byPart === 'object' ? x.byPart : {};
      const budgets = x.presupuestoByPart && typeof x.presupuestoByPart === 'object' ? x.presupuestoByPart : {};
      const key = text(part.partNo).trim();
      obra = text(byPart[key]).trim();
      const b = budgets[key] || {};
      presupuesto = b.presupuesto === 'SI' ? 'SI' : 'NO';
      numero = text(b.numero).trim();
    } catch (_) {}
    if (!obra || presupuesto !== 'SI') {
      try {
        const all = JSON.parse(ls.getItem('APP_AVISOS_OBRA_PRESUPUESTO_V135') || '{}') || {};
        const a = all[String(text(part.avisoId || part.avisoNo).trim())] || {};
        if (!obra) obra = text(a.obra).trim();
        if (presupuesto !== 'SI' && a.presupuesto === 'SI') {
          presupuesto = 'SI';
          numero = text(a.numero).trim();
        }
      } catch (_) {}
    }
    return { obra, presupuesto, numero };
  }

  async function create(part) {
    part = db().normalize(part); const extra = obraPresupuesto(part); part.obra = extra.obra; part.presupuesto = extra.presupuesto; part.presupuestoNumero = extra.numero; const company = db().main().empresa || {};
    const pages = [await singlePage(part, company)];
    const blob = pdfFromCanvases(pages); const filename = ('Parte_' + part.partNo + '_' + (part.cliente || 'cliente')).replace(/[^a-zA-Z0-9._-]+/g, '_') + '.pdf';
    return new (appWindow().File)([blob], filename, { type: 'application/pdf', lastModified: Date.now() });
  }

  async function share(part) {
    const file = await create(part), nav = appWindow().navigator;
    const data = { files: [file], title: 'Parte de trabajo ' + part.partNo, text: 'Parte ' + part.partNo + ' · Aviso ' + part.avisoNo + ' · ' + part.cliente };
    let canShareFile = false;
    try { canShareFile = !!nav.share && (!nav.canShare || nav.canShare({ files: [file] })); } catch (_) {}
    if (canShareFile) { await nav.share(data); return { shared: true, file }; }
    return { shared: false, file };
  }

  async function download(part) {
    const file = await create(part), url = appWindow().URL.createObjectURL(file), anchor = appWindow().document.createElement('a');
    anchor.href = url; anchor.download = file.name; anchor.click(); appWindow().setTimeout(() => appWindow().URL.revokeObjectURL(url), 30000); return file;
  }

  async function preview(part) {
    const file = await create(part), url = appWindow().URL.createObjectURL(file), popup = appWindow().open(url, '_blank');
    if (!popup) { appWindow().URL.revokeObjectURL(url); throw new Error('El navegador ha bloqueado la vista del PDF.'); }
    appWindow().setTimeout(() => appWindow().URL.revokeObjectURL(url), 120000); return file;
  }

  async function emailFile(part) {
    const file = await create(part), bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const base64 = appWindow().btoa(binary).replace(/.{1,76}/g, '$&\r\n'); const boundary = 'SOLTEC-' + Date.now();
    const eml = ['To: ' + text(part.email), 'Subject: Parte de trabajo ' + part.partNo, 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="' + boundary + '"', '', '--' + boundary, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: 8bit', '', 'Adjuntamos el parte de trabajo ' + part.partNo + ', correspondiente al aviso ' + part.avisoNo + '.', '', '--' + boundary, 'Content-Type: application/pdf; name="' + file.name + '"', 'Content-Disposition: attachment; filename="' + file.name + '"', 'Content-Transfer-Encoding: base64', '', base64, '--' + boundary + '--'].join('\r\n');
    const blob = new (appWindow().Blob)([eml], { type: 'message/rfc822' }), url = appWindow().URL.createObjectURL(blob), anchor = appWindow().document.createElement('a');
    anchor.href = url; anchor.download = 'Correo_' + part.partNo + '.eml'; anchor.click(); appWindow().setTimeout(() => appWindow().URL.revokeObjectURL(url), 30000); return file;
  }

  window.SoltecPartesPdf135 = { create, share, download, preview, emailFile };
})();
