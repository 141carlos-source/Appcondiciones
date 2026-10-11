// Datos INVENTADOS con el mismo formato que el soltec-central.json de la V1.35 (sin datos reales).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 condiciones de prueba').toString('base64');
const PDF2 = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 condiciones version 2').toString('base64');
const blob = (data, mime, name = '') => ({ __soltecBlob: 1, mime, name, data });
const aviso = (id, extra = {}) => ({ id, creado: new Date(id).toISOString(), actualizado: new Date(id).toISOString(), fecha: new Date(id).toISOString().slice(0, 10), estado: 'en_curso',
  cliente: '', contacto: '', nif: '', telefono: '', email: '', refCatastral: '', direccion: '', piso: '', puerta: '', cp: '', localidad: '', provincia: '',
  latitud: '', longitud: '', cupsE: '', cupsG: '', tension: '230 V MONOFÁSICA', iga: '', potenciaCalculada: '', potenciaSolicitada: '', concepto: '', observaciones: '', eliminadoEn: '', ...extra });
const A = 1788300000001, B = 1788400000002, C = 1788500000003, T = 1788350000004; // números inventados (2026)
const tecnica = { viviendas: [{ concepto: 'VIVIENDA 1', escalera: '', piso: '1', puerta: 'A', potencia: '9,2', tension: '230 V', grado: 'ELEVADA' }, {}, {}], locales: [{}, {}], servicios: [{}, {}, {}], garajes: [{}, { concepto: 'PUNTOS RECARGA VE', tipo: '1 plaza', potencia: '7,4', tension: '230 V', superficie: '' }], acumulacion: { aplica: 'NO', tipo: '', potencia: '', capacidad: '' }, autoconsumo: { aplica: 'SÍ', consumo: '5', generacion: '3' }, potenciaTotal: '' };

export function centralDePrueba() {
  const main = {
    schema: 3,
    empresa: { nombre: 'EMPRESA DE PRUEBA SL', nombreComercial: 'PRUEBA', nif: 'B00000000', telefono: '600000000', email: 'prueba@ejemplo.es', web: '', direccion: 'Calle Falsa 1', cp: '50001', localidad: 'Zaragoza', provincia: 'Zaragoza', logoData: PNG },
    tecnico: { nombre: 'Técnico Prueba', nif: '', telefono: '', email: '', numero: '', colegiado: '' },
    solicitante: { nombre: '', nif: '', telefono: '', email: '', direccion: '', cp: '', localidad: '', provincia: '' },
    avisos: [
      aviso(A, { cliente: 'Cliente Uno', nif: '12345678z', telefono: '600111222', direccion: 'Calle Primera 1', piso: '2', puerta: 'B', cp: '50001', localidad: 'Zaragoza', provincia: 'Zaragoza', latitud: '41.65', longitud: '-0.88', cupsE: 'es0031408123456789xx', potenciaSolicitada: '15', potenciaCalculada: '14.49', iga: '63', concepto: 'Nueva vivienda', refCondiciones: '0000111222' }),
      aviso(B, { cliente: 'Cliente Dos', direccion: 'Avenida Segunda 2', estado: 'finalizado', potenciaSolicitada: '5.75' }),
      aviso(C, { cliente: 'Cliente Tres', direccion: 'Plaza Tercera 3', estado: 'pendiente', tension: '400 V TRIFÁSICA' }),
    ],
    papelera: [aviso(T, { cliente: 'Cliente Borrado', direccion: 'Calle Borrada 9', eliminadoEn: '2026-09-20T10:00:00Z' })],
  };
  const ls = {
    APP_AVISOS_WEB_DATOS_V116_PERSISTENTE: JSON.stringify(main),
    APP_AVISOS_CONFIG_V127: JSON.stringify({ emails: { nuevosSuministros: 'nuevos@dist.es', comercializadora1: 'altas@com.es' }, selloData: PNG }),
    APP_AVISOS_FLAGS_V120: JSON.stringify({ [A]: { iban: 'es9121000418450200051332', condicionesSuministro: true, contratoElectricidad: true } }),
    APP_AVISOS_CUPS_V127: JSON.stringify({ [A]: true }),
    APP_AVISOS_SUMINISTRO_V129: JSON.stringify({ [C]: { contador: 'C-1', contadorCercano: '', refCondiciones: '0000333444', tipoSolicitud: 'NUEVO SUMINISTRO', usoFinca: 'VIVIENDA', tecnica, direccionFiscal: 'Calle Fiscal 5', emailFiscal: 'fiscal@ejemplo.es' } }),
    APP_AVISOS_OBRA_PRESUPUESTO_V135: JSON.stringify({ [A]: { obra: 'Obra Uno', presupuesto: 'SÍ', numero: 'P-77' } }),
    APP_AVISOS_MEMORIA_OBS_V128: JSON.stringify({ [A]: 'Acometida subterránea' }),
    APP_AVISOS_GESTION_V135: JSON.stringify({ schema: 1, byAviso: { [C]: { events: [{ id: 'e1', at: '2026-09-15T09:00:00Z', title: 'Solicitud presentada', note: 'por la web' }], tasks: [] } } }),
    APP_AVISOS_AGENDA_V135: JSON.stringify({ schema: 'SOLTEC_AGENDA_SYNC_V1', rows: [{ id: 'ag1', title: 'Visita obra', client: 'Cliente Uno', work: 'Revisar CGP', address: 'Calle Primera 1', phone: '600111222', tech: 'Técnico Prueba', date: '2026-10-20', time: '09:00', duration: 60, priority: 'medium', status: 'Pendiente', alarm: '', notes: 'Llevar escalera', photos: [], voiceNotes: [], materials: [], checklist: [], realStart: '', realEnd: '' }] }),
    APP_AVISOS_PARTES_V134: JSON.stringify([{ schema: 'x', build: 'x', id: 'PT-1-abc', partNo: 'PT-2026-00001', avisoId: String(A), avisoNo: String(A), fecha: '2026-09-17', tecnico: 'Técnico Prueba', cliente: 'Cliente Uno', direccion: 'Calle Primera 1', piso: '2', puerta: 'B', contacto: '', nif: '', telefono: '', email: '', cp: '', localidad: '', provincia: '', trabajos: 'Cambio de diferencial', conceptos: { desplazamiento: true, disponibilidad: false, urgencia: false }, manoObraHoras: '2', materiales: [{ cantidad: '1', descripcion: 'Diferencial 40A', referencia: 'REF-1', observaciones: '' }], observaciones: '', resultado: 'Resuelto', firmante: 'Cliente Uno', firmanteNif: '12345678z', firmaCliente: PNG, firmaTecnico: '', signedAt: '2026-09-17T12:00:00Z', sentAt: '', sentVia: '', status: 'sent', locked: true, createdAt: '', updatedAt: '' }]),
    APP_AVISOS_PARTES_FOTOS_V135: JSON.stringify({ 'PT-2026-00001': [PNG] }),
  };
  const estado = [
    { key: 'APP_AVISOS_CONDICIONES_HIST_V135_' + A, value: [{ blob: blob(PDF, 'application/pdf', 'COND_V1.pdf'), guardadoEn: '2026-09-10T10:00:00Z', nombre: 'COND_V1.pdf', tipo: 'application/pdf' }] },
    { key: 'APP_AVISOS_CONDICIONES_V129_' + A, value: { blob: blob(PDF2, 'application/pdf', 'COND_V2.pdf'), guardadoEn: '2026-09-12T10:00:00Z', nombre: 'COND_V2.pdf', tipo: 'application/pdf' } },
    { key: 'APP_AVISOS_FOTOS_V123_' + A, value: [{ blob: blob(PNG, 'image/png'), cgp: true, creadaEn: '', nombre: 'CGP fachada' }, { blob: blob(PNG.replace('A60e6', 'A60e7'), 'image/png'), cgp: false, creadaEn: '', nombre: 'Portal' }] },
    { key: 'APP_AVISOS_TRABAJOS_V129_' + A, value: [{ blob: blob(PNG, 'image/png'), creadaEn: '', nombre: 'Trabajo hecho' }] },
  ];
  const planos = [{ key: String(C), value: { blob: blob(PNG, 'image/png'), nombre: 'PLANO_C.png', direccion: '', generadoEn: '', latitud: '', longitud: '', origen: 'IGN', refCatastral: '' } }];
  return { revision: 42, updatedAt: '2026-10-08T13:51:14Z', snapshot: { schema: 'SOLTEC_SYNC_SNAPSHOT_V134', localStorage: ls, indexedDB: { name: 'APP_AVISOS_PERSISTENCIA', version: 3, stores: { estado, planos } } } };
}
export const IDS = { A, B, C, T };
