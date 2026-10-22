/* SOLTEC V2 · PDF de la autorización de representatividad (u otro documento de páginas A4 en HTML).
   Cada «.page» se dibuja como imagen (SVG foreignObject → canvas → JPEG) y se mete en un PDF A4 con pdf-lib.
   Así el PDF sale igual que el impreso, con los mismos estilos de la página.
   Uso: const blob = await AutorizacionPdf.crear({ html, ajustar, css, pdfLib })
   En iPad/Safari puede fallar al dibujar el SVG: quien llama debe ofrecer «Imprimir / PDF» como alternativa. */
(function (raiz, fabrica) {
  const P = fabrica(raiz);
  if (typeof module === 'object' && module.exports) module.exports = P;
  else raiz.AutorizacionPdf = P;
})(typeof globalThis !== 'undefined' ? globalThis : self, function (raiz) {
  'use strict';
  /** Tamaño de página A4: en píxeles CSS (96 ppp) y en puntos PDF. */
  const A4 = { w: 794, h: 1123, pw: 595.28, ph: 841.89 };

  /** Carga pdf-lib si aún no está (ruta relativa a la página). */
  function cargarPdfLib(ruta = '../vendor/pdf-lib.min.js') {
    if (raiz.PDFLib) return Promise.resolve(raiz.PDFLib);
    const d = raiz.document;
    return new Promise((ok, ko) => {
      const s = d.createElement('script');
      s.src = ruta;
      s.onload = () => ok(raiz.PDFLib);
      s.onerror = () => ko(new Error('No se pudo cargar el generador de PDF'));
      d.head.appendChild(s);
    });
  }

  /** SVG de una página: el HTML dentro de un foreignObject con los estilos de la página. */
  const svgPagina = (xhtml, css, w = A4.w, h = A4.h) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="background:#fff"><style>${String(css).replace(/<\/?style>/g, '')}</style>${xhtml}</div></foreignObject></svg>`;

  /**
   * PDF de un documento HTML con páginas «.page».
   * @param {object} o
   * @param {string} o.html     HTML del documento (se mete en un <div class="doc">)
   * @param {Function} [o.ajustar] se llama con el contenedor ya en la página (p. ej. reducir letra de campos)
   * @param {string} [o.css]    estilos (por defecto, los <style> de la página)
   * @param {object} [o.pdfLib] pdf-lib (por defecto se carga)
   * @param {number} [o.escala] resolución (2 = doble de nítido)
   * @returns {Promise<Blob>} application/pdf
   */
  async function crear({ html, ajustar, css, pdfLib, escala = 2, calidad = 0.92 } = {}) {
    const d = raiz.document;
    const box = d.createElement('div');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;background:#fff';
    box.innerHTML = `<div class="doc">${html}</div>`;
    d.body.appendChild(box);
    try {
      if (ajustar) ajustar(box);
      await Promise.all([...box.querySelectorAll('img')].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
      const L = pdfLib || (await cargarPdfLib());
      const estilos = css ?? [...d.querySelectorAll('style')].map((s) => s.textContent).join('\n');
      const pdf = await L.PDFDocument.create();
      const paginas = box.querySelectorAll('.page');
      if (!paginas.length) throw new Error('El documento no tiene páginas');
      for (const pg of paginas) {
        const c = pg.cloneNode(true);
        c.style.margin = '0';
        c.style.boxShadow = 'none';
        const w = d.createElement('div');
        w.className = 'doc';
        w.appendChild(c);
        const im = new Image();
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgPagina(new XMLSerializer().serializeToString(w), estilos));
        await im.decode();
        const cv = d.createElement('canvas');
        cv.width = A4.w * escala; cv.height = A4.h * escala;
        const g = cv.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.scale(escala, escala); g.drawImage(im, 0, 0, A4.w, A4.h);
        const jpg = await new Promise((ok, ko) => { try { cv.toBlob((b) => (b ? ok(b) : ko(new Error('vacío'))), 'image/jpeg', calidad); } catch (e) { ko(e); } });
        const ij = await pdf.embedJpg(await jpg.arrayBuffer());
        pdf.addPage([A4.pw, A4.ph]).drawImage(ij, { x: 0, y: 0, width: A4.pw, height: A4.ph });
      }
      return new Blob([await pdf.save()], { type: 'application/pdf' });
    } finally { box.remove(); }
  }

  return { A4, crear, cargarPdfLib, svgPagina };
});
