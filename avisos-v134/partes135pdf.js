(function () {
  'use strict';

  const PAGE_W = 1240;
  const PAGE_H = 1754;
  const MARGIN = 72;
  const RED = '#e7281c';
  const INK = '#182033';
  const MUTED = '#667085';
  const LINE = '#d6dbe3';

  const text = value => value == null ? '' : String(value);
  const db = () => window.SoltecDB135;
  const appWindow = () => db().window();

  function canvasPage() {
    const canvas = appWindow().document.createElement('canvas');
    canvas.width = PAGE_W; canvas.height = PAGE_H;
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
    page.ctx.beginPath(); page.ctx.moveTo(MARGIN, page.y); page.ctx.lineTo(PAGE_W - MARGIN, page.y); page.ctx.stroke(); page.y += 20;
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
    page.y += 14; font(page.ctx, 29, true); page.ctx.fillStyle = RED; page.ctx.fillText(value, MARGIN, page.y); page.y += 44;
  }

  function labelValue(page, label, value, x, width) {
    font(page.ctx, 17, true); page.ctx.fillStyle = MUTED; page.ctx.fillText(label.toUpperCase(), x, page.y);
    font(page.ctx, 23, false); page.ctx.fillStyle = INK;
    const height = wrapped(page.ctx, value || '—', x, page.y + 24, width, 29, 3);
    return height + 32;
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

  async function firstPage(part, company) {
    const page = canvasPage(), ctx = page.ctx;
    const logo = await loadImage(company.logoData);
    if (logo) fitImage(ctx, logo, MARGIN, page.y, 220, 105);
    const companyX = logo ? 320 : MARGIN;
    font(ctx, 31, true); ctx.fillText(company.nombre || company.nombreComercial || 'M. A. SOLTEC SL', companyX, page.y);
    font(ctx, 18, false); ctx.fillStyle = MUTED;
    const companyLine = [company.nif && 'NIF/CIF ' + company.nif, company.telefono, company.email].filter(Boolean).join(' · ');
    wrapped(ctx, companyLine, companyX, page.y + 42, PAGE_W - companyX - MARGIN, 24, 2);
    const address = [company.direccion, [company.cp, company.localidad].filter(Boolean).join(' '), company.provincia].filter(Boolean).join(' · ');
    wrapped(ctx, address, companyX, page.y + 70, PAGE_W - companyX - MARGIN, 24, 2);
    page.y += 125; ctx.fillStyle = RED; ctx.fillRect(MARGIN, page.y, PAGE_W - MARGIN * 2, 8); page.y += 30;
    font(ctx, 45, true); ctx.fillStyle = INK; ctx.fillText('PARTE DE TRABAJO', MARGIN, page.y);
    font(ctx, 25, true); ctx.fillStyle = RED; ctx.textAlign = 'right'; ctx.fillText(part.partNo, PAGE_W - MARGIN, page.y + 8); ctx.textAlign = 'left'; page.y += 70;

    const col = (PAGE_W - MARGIN * 2 - 34) / 2;
    let y0 = page.y; const h1 = labelValue(page, 'Nº aviso', part.avisoNo, MARGIN, col); page.y = y0; const h2 = labelValue(page, 'Fecha', formatDate(part.fecha), MARGIN + col + 34, col); page.y = y0 + Math.max(h1, h2) + 10;
    y0 = page.y; const h3 = labelValue(page, 'Cliente', part.cliente, MARGIN, col); page.y = y0; const h4 = labelValue(page, 'Técnico', part.tecnico, MARGIN + col + 34, col); page.y = y0 + Math.max(h3, h4) + 10;
    const addressH = labelValue(page, 'Dirección', [part.direccion, [part.cp, part.localidad].filter(Boolean).join(' '), part.provincia].filter(Boolean).join(' · '), MARGIN, PAGE_W - MARGIN * 2); page.y += addressH + 4;
    y0 = page.y; const h5 = labelValue(page, 'Contacto', part.contacto, MARGIN, col); page.y = y0; const h6 = labelValue(page, 'NIF/CIF', part.nif, MARGIN + col + 34, col); page.y = y0 + Math.max(h5, h6) + 10;
    y0 = page.y; const h7 = labelValue(page, 'Teléfono', part.telefono, MARGIN, col); page.y = y0; const h8 = labelValue(page, 'Email', part.email, MARGIN + col + 34, col); page.y = y0 + Math.max(h7, h8) + 8;
    line(page);

    heading(page, 'Trabajos realizados'); font(ctx, 22, false); ctx.fillStyle = INK;
    page.y += wrapped(ctx, part.trabajos || '—', MARGIN, page.y, PAGE_W - MARGIN * 2, 31, 15) + 16;
    line(page);
    heading(page, 'Conceptos');
    const concepts = [part.conceptos.desplazamiento && 'Desplazamiento', part.conceptos.disponibilidad && 'Disponibilidad', part.conceptos.urgencia && 'Urgencia'].filter(Boolean);
    font(ctx, 22, false); ctx.fillStyle = INK; ctx.fillText(concepts.length ? concepts.join(' · ') : 'Sin conceptos adicionales', MARGIN, page.y); page.y += 42;
    font(ctx, 24, true); ctx.fillText('Mano de obra: ' + text(part.manoObraHoras || '0') + ' horas', MARGIN, page.y); page.y += 55;
    heading(page, 'Resultado'); font(ctx, 23, true); ctx.fillStyle = INK; ctx.fillText(part.resultado || '—', MARGIN, page.y);
    footer(page, part, 1);
    return page.canvas;
  }

  async function secondPage(part) {
    const page = canvasPage(), ctx = page.ctx;
    font(ctx, 34, true); ctx.fillStyle = INK; ctx.fillText('PARTE ' + part.partNo, MARGIN, page.y);
    font(ctx, 20, false); ctx.fillStyle = MUTED; ctx.textAlign = 'right'; ctx.fillText('Aviso ' + part.avisoNo, PAGE_W - MARGIN, page.y + 8); ctx.textAlign = 'left'; page.y += 65; line(page, RED);
    heading(page, 'Material empleado');
    const materials = part.materiales || [];
    if (!materials.length) { font(ctx, 21, false); ctx.fillText('No se ha indicado material.', MARGIN, page.y); page.y += 42; }
    materials.forEach((row, index) => {
      font(ctx, 19, true); ctx.fillText((index + 1) + '. ' + (row.cantidad ? row.cantidad + ' × ' : '') + (row.descripcion || 'Material'), MARGIN, page.y);
      font(ctx, 17, false); ctx.fillStyle = MUTED;
      const detail = [row.referencia && 'Ref. ' + row.referencia, row.observaciones].filter(Boolean).join(' · ');
      page.y += 26 + wrapped(ctx, detail, MARGIN + 24, page.y + 25, PAGE_W - MARGIN * 2 - 24, 23, 3) + 14;
    });
    line(page);
    heading(page, 'Observaciones'); font(ctx, 21, false); ctx.fillStyle = INK;
    page.y += wrapped(ctx, part.observaciones || '—', MARGIN, page.y, PAGE_W - MARGIN * 2, 29, 12) + 18;
    line(page);
    heading(page, 'Firmas');
    const signClient = await loadImage(part.firmaCliente), signTech = await loadImage(part.firmaTecnico);
    const col = (PAGE_W - MARGIN * 2 - 36) / 2, sigTop = page.y;
    font(ctx, 20, true); ctx.fillText('CLIENTE', MARGIN, sigTop); ctx.fillText('TÉCNICO', MARGIN + col + 36, sigTop);
    ctx.strokeStyle = LINE; ctx.strokeRect(MARGIN, sigTop + 35, col, 235); ctx.strokeRect(MARGIN + col + 36, sigTop + 35, col, 235);
    fitImage(ctx, signClient, MARGIN + 8, sigTop + 43, col - 16, 219); fitImage(ctx, signTech, MARGIN + col + 44, sigTop + 43, col - 16, 219);
    font(ctx, 18, false); ctx.fillStyle = INK; ctx.fillText(part.firmante || '—', MARGIN, sigTop + 287); ctx.fillText(part.tecnico || '—', MARGIN + col + 36, sigTop + 287);
    font(ctx, 16, false); ctx.fillStyle = MUTED; ctx.fillText(part.firmanteNif ? 'DNI/NIF ' + part.firmanteNif : '', MARGIN, sigTop + 315);
    ctx.fillText(part.signedAt ? formatDateTime(part.signedAt) : '', MARGIN, sigTop + 343);
    footer(page, part, 2);
    return page.canvas;
  }

  function footer(page, part, number) {
    const ctx = page.ctx; ctx.strokeStyle = LINE; ctx.beginPath(); ctx.moveTo(MARGIN, PAGE_H - 74); ctx.lineTo(PAGE_W - MARGIN, PAGE_H - 74); ctx.stroke();
    font(ctx, 15, false); ctx.fillStyle = MUTED; ctx.fillText('M. A. SOLTEC SL · ' + part.partNo, MARGIN, PAGE_H - 52); ctx.textAlign = 'right'; ctx.fillText('Página ' + number + '/2', PAGE_W - MARGIN, PAGE_H - 52); ctx.textAlign = 'left';
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

  async function create(part) {
    part = db().normalize(part); const company = db().main().empresa || {};
    const pages = [await firstPage(part, company), await secondPage(part)];
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
