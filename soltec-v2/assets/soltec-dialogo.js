/* SOLTEC V2 · Ventanas de aviso, confirmación y pregunta comunes a la app, CuadroLab y la autorización.
   Mismo aspecto que SOLTEC V2: tarjeta blanca, letra Archivo, botones grandes para el dedo.
   Intro = Aceptar, Esc = Cancelar (o tocar fuera). Una ventana cada vez: una nueva cierra la anterior (como Cancelar).
   Uso (como <script> deja window.SoltecDialogo; con import, globalThis.SoltecDialogo):
     await SoltecDialogo.aviso('NO HAY ESPACIO LIBRE')
     if (await SoltecDialogo.confirmar('¿Borrar?', { si: 'Borrar', peligro: true })) …
     const v = await SoltecDialogo.preguntar('Nombre', { valor: '', opciones: [[valor, texto]…] })   // null = cancelado
   Los botones llevan id dk (aceptar) y dc (cancelar) y el campo dg, como las ventanas antiguas de CuadroLab. */
(function (raiz, fabrica) {
  const D = fabrica(raiz);
  if (typeof module === 'object' && module.exports) module.exports = D;
  else raiz.SoltecDialogo = D;
})(typeof globalThis !== 'undefined' ? globalThis : self, function (raiz) {
  'use strict';
  const doc = () => raiz.document;
  const CSS = `
.sd-fondo{position:fixed;inset:0;z-index:2147483000;background:rgba(20,24,28,.45);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;animation:sd-in .12s ease-out}
.sd-caja{background:#fff;color:#1e2226;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.25);width:min(440px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:20px 20px 16px;box-sizing:border-box;font-family:'Archivo',system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;text-transform:none;letter-spacing:normal}
.sd-titulo{font-size:17px;font-weight:800;margin:0 0 8px}
.sd-texto{font-size:15px;line-height:1.45;margin:0 0 16px;white-space:pre-line;word-wrap:break-word}
.sd-campo{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:11px 12px;border:1.5px solid #c6ccd3;border-radius:10px;background:#fff;color:#1e2226;margin:0 0 16px}
.sd-campo:focus{outline:2px solid #1e2226;outline-offset:1px}
.sd-botones{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.sd-btn{font:inherit;font-size:15px;font-weight:700;min-height:44px;min-width:110px;padding:10px 18px;border-radius:10px;border:1.5px solid #dfe3e8;background:#fff;color:#1e2226;cursor:pointer}
.sd-btn.sd-si{background:#1e2226;border-color:#1e2226;color:#fff}
.sd-btn.sd-peligro{background:#c4161c;border-color:#c4161c;color:#fff}
.sd-btn:focus-visible{outline:3px solid #8fb3ff;outline-offset:2px}
@keyframes sd-in{from{opacity:0}to{opacity:1}}
@media (max-width:420px){.sd-botones{flex-direction:column-reverse}.sd-btn{width:100%}}
@media print{.sd-fondo{display:none!important}}`;
  let actual = null; // { cerrar(valor) }

  function estilos() {
    const d = doc();
    if (d.getElementById('soltec-dialogo-css')) return;
    const s = d.createElement('style');
    s.id = 'soltec-dialogo-css';
    s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }
  const el = (tag, props = {}, txt) => { const e = doc().createElement(tag); Object.assign(e, props); if (txt != null) e.textContent = txt; return e; };

  /**
   * Ventana general. tipo: 'aviso' | 'confirmar' | 'preguntar'.
   * Devuelve una promesa: aviso → true; confirmar → true/false; preguntar → texto/valor o null.
   */
  function abrir(tipo, mensaje, o = {}) {
    if (actual) actual.cerrar(undefined);
    estilos();
    return new Promise((resolver) => {
      const d = doc(), antes = d.activeElement;
      const fondo = el('div', { className: 'sd-fondo dlgx' });
      const caja = el('div', { className: 'sd-caja' });
      caja.setAttribute('role', tipo === 'aviso' ? 'alertdialog' : 'dialog');
      caja.setAttribute('aria-modal', 'true');
      if (o.titulo) caja.appendChild(el('h2', { className: 'sd-titulo' }, o.titulo));
      const texto = el('p', { className: 'sd-texto', id: 'sd-texto' }, String(mensaje ?? ''));
      caja.setAttribute('aria-describedby', 'sd-texto');
      caja.appendChild(texto);
      let campo = null;
      if (tipo === 'preguntar') {
        if (o.opciones) {
          campo = el('select', { className: 'sd-campo', id: 'dg' });
          for (const [v, t] of o.opciones) campo.appendChild(el('option', { value: String(v) }, String(t)));
          if (o.valor != null) campo.value = String(o.valor);
        } else {
          campo = el('input', { className: 'sd-campo', id: 'dg', type: 'text', value: o.valor ?? '' });
          campo.setAttribute('autocomplete', 'off');
          if (o.mayusculas) campo.style.textTransform = 'uppercase';
        }
        campo.setAttribute('aria-labelledby', 'sd-texto');
        caja.appendChild(campo);
      }
      const botones = el('div', { className: 'sd-botones' });
      const si = el('button', { type: 'button', id: 'dk', className: 'sd-btn ' + (o.peligro ? 'sd-peligro' : 'sd-si') }, o.si || 'Aceptar');
      const no = tipo === 'aviso' ? null : el('button', { type: 'button', id: 'dc', className: 'sd-btn' }, o.no || 'Cancelar');
      if (no) botones.appendChild(no);
      botones.appendChild(si);
      caja.appendChild(botones);
      fondo.appendChild(caja);

      let hecho = false;
      const cerrar = (valor) => {
        if (hecho) return;
        hecho = true;
        actual = null;
        d.removeEventListener('keydown', teclas, true);
        fondo.remove();
        try { if (antes && antes.focus && d.contains(antes)) antes.focus(); } catch { /* sin foco previo */ }
        const cancel = tipo === 'aviso' ? true : tipo === 'confirmar' ? false : null;
        resolver(valor === undefined ? cancel : valor);
      };
      const aceptar = () => {
        if (tipo === 'aviso' || tipo === 'confirmar') return cerrar(true);
        let v = campo.value;
        if (o.mayusculas && typeof v === 'string') v = v.toUpperCase();
        cerrar(v);
      };
      const teclas = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(undefined); }
        else if (e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON' && e.target !== si)) { e.preventDefault(); e.stopPropagation(); aceptar(); }
        else if (e.key === 'Tab') { // el foco no sale de la ventana
          const f = [campo, no, si].filter(Boolean), i = f.indexOf(d.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
        }
      };
      si.onclick = aceptar;
      if (no) no.onclick = () => cerrar(undefined);
      fondo.addEventListener('mousedown', (e) => { if (e.target === fondo && tipo !== 'aviso') cerrar(undefined); });
      d.addEventListener('keydown', teclas, true);
      d.body.appendChild(fondo);
      actual = { cerrar };
      (campo || si).focus();
      if (campo && campo.select && campo.tagName === 'INPUT') campo.select();
    });
  }

  const aviso = (mensaje, o) => abrir('aviso', mensaje, o);
  const confirmar = (mensaje, o) => abrir('confirmar', mensaje, o);
  const preguntar = (mensaje, o) => abrir('preguntar', mensaje, o);
  /** ¿Hay una ventana abierta? */
  const abierta = () => !!actual;
  /** Cierra la ventana abierta como si se cancelara. */
  const cerrar = () => { if (actual) actual.cerrar(undefined); };

  return { aviso, confirmar, preguntar, abierta, cerrar };
});
