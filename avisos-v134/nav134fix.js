(function () {
  'use strict';

  function layout(document, nav) {
    const buttons = Array.from(nav.querySelectorAll(':scope > button'));
    nav.style.gridTemplateColumns = 'repeat(' + Math.max(1, buttons.length) + ',minmax(0,1fr))';
    nav.style.columnGap = '4px';
    buttons.forEach(button => {
      button.style.minHeight = '52px'; button.style.padding = '8px 3px'; button.style.fontSize = '12px';
    });
    const main = document.querySelector('main');
    if (main) main.style.paddingBottom = '105px';
  }

  function ensure(app) {
    try {
      const document = app.document;
      let nav = document.querySelector('nav.bottom');
      if (!nav) {
        nav = document.createElement('nav'); nav.className = 'bottom'; nav.setAttribute('aria-label', 'Navegación principal'); document.body.appendChild(nav);
      }
      const definitions = [
        ['navInicio', '⌂<br>Inicio', () => app.App && app.App.show('inicio')],
        ['navAvisos', '☰<br>Avisos', () => app.App && app.App.show('avisos')],
        ['navPartes', '🧾<br>Partes', () => window.SoltecPartes135 && window.SoltecPartes135.show()],
        ['navConfig', '⚙<br>Empresa', () => app.App && app.App.show('config')]
      ];
      definitions.forEach(([id, label, action]) => {
        let button = document.getElementById(id);
        if (!button) { button = document.createElement('button'); button.type = 'button'; button.id = id; nav.appendChild(button); }
        button.innerHTML = label; button.onclick = action;
      });
      let finish = document.getElementById('navFinalizar');
      if (!finish) { finish = document.createElement('button'); finish.type = 'button'; finish.id = 'navFinalizar'; nav.appendChild(finish); }
      finish.innerHTML = '✅<br>Finalizar';
      finish.onclick = () => window.Soltec134Engine && window.Soltec134Engine.finalizar(app);
      layout(document, nav);
    } catch (error) {
      console.error('V1.35 NAV', error);
    }
  }

  window.Soltec134NavFix = {
    init(app) {
      ensure(app); setTimeout(() => ensure(app), 200); setTimeout(() => ensure(app), 1000);
    }
  };
})();
