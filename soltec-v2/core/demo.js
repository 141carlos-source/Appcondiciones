// SOLTEC V2 · Modo demostración: la app con datos de ejemplo inventados en una base de datos aparte.
// No toca los datos reales ni sincroniza con el PC. Sirve para probar aspectos (temas) y enseñar la app.
// Se abre con index.html?demo=1 (y &tema=1…4 para elegir el aspecto).

import { nuevoAviso, hoyLocal } from './model.js';

export const DB_DEMO = 'SOLTEC_V2_DEMO';

/** Temas de aspecto disponibles (archivo assets/temas/tema-N.css). 0 = el aspecto actual. */
export const TEMAS = [
  { id: 0, nombre: 'Actual', idea: 'El aspecto de ahora (1.27)' },
  { id: 1, nombre: 'Cuadro', idea: 'Como un cuadro eléctrico: azul marino, paneles blancos, letra estrecha' },
  { id: 2, nombre: 'Plano', idea: 'Como un plano técnico: tinta de plano sobre papel cuadriculado' },
  { id: 3, nombre: 'Obra', idea: 'Para la obra a pleno sol: máximo contraste, letra y botones grandes' },
  { id: 4, nombre: 'Despacho', idea: 'Tranquilo y de oficina; menú lateral en PC y tablet' },
];

/** Lee ?demo y ?tema de la dirección. */
export function opcionesDemo(search = '') {
  const p = new URLSearchParams(search);
  const t = parseInt(p.get('tema') || '0', 10);
  return { demo: p.get('demo') === '1', tema: TEMAS.some((x) => x.id === t) ? t : 0 };
}

const dia = (hoy, n) => { const d = new Date(hoy + 'T12:00:00'); d.setDate(d.getDate() + n); return hoyLocal(d); };
const hace = (n) => new Date(Date.now() - n * 86400000).toISOString();

/** Registros de ejemplo (ids fijos: sembrar dos veces no duplica). Datos inventados. */
export function datosDemo(hoy = hoyLocal()) {
  const sum = (direccion, numero, poblacion, cp, extra = {}) => ({ direccion, numero, piso: '', puerta: '', cp, poblacion, provincia: 'ZARAGOZA', refCatastral: '', lat: '', lon: '', cups: '', ...extra });
  const cli = (nombre, nif, telefono, email = '', contacto = '') => ({ nombre, nif, telefono, email, contacto, iban: '' });
  const avisos = [
    { id: 'demo_av1', data: nuevoAviso({ numero: '2026-0141', fecha: dia(hoy, -2), concepto: 'Nuevo suministro', tramite: 'datos', cliente: cli('PANADERÍA LA ESPIGA SL', 'B50987650', '+34 976 555 101', 'pedidos@laespiga.es', 'LUIS'), suministro: sum('CALLE MAYOR', '14', 'LA PUEBLA DE ALFINDÉN', '50171'), electrico: { tension: '400', iga: '63', potenciaCalculada: '43,65', potenciaKw: '', uso: 'local' } }) },
    { id: 'demo_av2', data: nuevoAviso({ numero: '2026-0138', fecha: dia(hoy, -20), concepto: 'Aumento de potencia', tramite: 'presentado', cliente: cli('MARÍA PILAR GÓMEZ RUIZ', '25467812G', '+34 654 210 778', 'mpgomez@correo.es'), suministro: sum('AVENIDA CATALUÑA', '220', 'ZARAGOZA', '50014', { piso: '3', puerta: 'B', cups: 'ES0031405012345678JN0F' }), electrico: { tension: '230', iga: '40', potenciaCalculada: '9,2', potenciaKw: '9,2', uso: 'vivienda' }, condiciones: { ref: 'SOL-2026-48112', pdfs: [] } }) },
    { id: 'demo_av3', data: nuevoAviso({ numero: '2026-0135', fecha: dia(hoy, -9), concepto: 'Nave nueva con recarga de vehículo', tramite: 'firma', cliente: cli('TRANSPORTES EBRO NORTE SL', 'B99112237', '+34 976 140 900', 'administracion@ebronorte.es', 'ANA'), suministro: sum('POLÍGONO MALPICA, CALLE E', '23', 'ZARAGOZA', '50016'), electrico: { tension: '400', iga: '125', potenciaCalculada: '86,6', potenciaKw: '86,6', uso: 'nave' } }) },
    { id: 'demo_av4', data: nuevoAviso({ numero: '2026-0129', fecha: dia(hoy, -35), concepto: 'Legalización de instalación', tramite: 'distribuidora', cliente: cli('COMUNIDAD DE PROPIETARIOS SOL 2', 'H50345677', '+34 976 302 118', '', 'PRESIDENTE'), suministro: sum('CALLE SOL', '2', 'ALFAJARÍN', '50172'), electrico: { tension: '400', iga: '80', potenciaKw: '55,4', uso: 'comunes' }, condiciones: { ref: 'SOL-2026-47790', pdfs: [] } }) },
    { id: 'demo_av5', data: nuevoAviso({ numero: '2026-0117', fecha: dia(hoy, -60), concepto: 'Cambio de titular', tramite: 'finalizado', estado: 'Cerrado', cliente: cli('JAVIER LÓPEZ MARTÍN', '17890123X', '+34 699 333 444'), suministro: sum('CALLE ARAGÓN', '7', 'PASTRIZ', '50195') }) },
    { id: 'demo_av6', data: nuevoAviso({ numero: '2026-0144', fecha: hoy, concepto: 'Avería en cuadro general', tramite: 'datos', cliente: cli('BAR EL CRUCE', '', '+34 976 555 666'), suministro: sum('CARRETERA CASTELLÓN', 'KM 8', 'LA PUEBLA DE ALFINDÉN', '50171') }) },
  ];
  // Historial: condiciones pedidas hace 20 días (sale un recordatorio) y otros movimientos
  const eventos = [
    { id: 'demo_ev1', ref: 'demo_av2', data: { at: hace(20), kind: 'solicitud_presentada', text: 'Solicitud presentada a e-distribución' } },
    { id: 'demo_ev2', ref: 'demo_av4', data: { at: hace(8), kind: 'solicitud_presentada', text: 'Solicitud presentada' } },
    { id: 'demo_ev3', ref: 'demo_av3', data: { at: hace(12), kind: 'doc_enviada', text: 'Ficha del cliente: enviado' } },
  ];
  const citas = [
    { id: 'demo_ci1', ref: 'demo_av6', data: { titulo: 'Revisar cuadro general · Bar El Cruce', fecha: hoy, hora: '09:30', responsable: 'CARLOS', notas: '', alarma: false, antelacion: 15, hecho: false } },
    { id: 'demo_ci2', ref: 'demo_av1', data: { titulo: 'Tomar datos del local', fecha: dia(hoy, 1), hora: '12:00', responsable: 'CARLOS', notas: '', alarma: false, antelacion: 15, hecho: false } },
    { id: 'demo_ci3', ref: 'demo_av3', data: { titulo: 'Llamar para la firma', fecha: dia(hoy, -1), hora: '', responsable: '', notas: '', alarma: false, antelacion: 0, hecho: false } },
  ];
  const partes = [
    { id: 'demo_pa1', ref: 'demo_av6', data: { numero: 'P-2026-0052', fecha: hoy, avisoNumero: '2026-0144', tecnico: 'CARLOS', cliente: { nombre: 'BAR EL CRUCE', nif: '', contacto: '', telefono: '+34 976 555 666', email: '', direccion: 'CARRETERA CASTELLÓN', numero: 'KM 8', piso: '', puerta: '', cp: '50171', localidad: 'LA PUEBLA DE ALFINDÉN', provincia: 'ZARAGOZA' }, trabajos: 'Sustitución de diferencial 40 A 30 mA disparado.', conceptos: { desplazamiento: true, disponibilidad: false, urgencia: true }, horas: '1,5', materiales: [{ ref: 'NL1-63', desc: 'DIFERENCIAL 2x40A 30mA', cantidad: '1' }], observaciones: '', resultado: '', fotos: [], firma: null, cerrado: false, cerradoAt: null } },
  ];
  const empresa = { id: 'empresa', data: { empresa: { nombre: 'M. A. SOLTEC SL', nombreComercial: 'SOLTEC', nif: '', telefono: '', email: '', web: '', direccion: '', cp: '50171', localidad: 'LA PUEBLA DE ALFINDÉN', provincia: 'ZARAGOZA' }, tecnico: { nombre: 'CARLOS', nif: '', telefono: '', email: '', numero: '', colegiado: '' } } };
  return { avisos, eventos, citas, partes, empresa };
}
