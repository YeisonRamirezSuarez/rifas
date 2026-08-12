/** Paletas y tipografías. Se aplican como variables CSS en :root. */

export type Paleta = {
  id: string;
  nombre: string;
  fondo: string;
  fondoOscuro: string;
  acento: string;
  acentoClaro: string;
  claro: string;
};

export const PALETAS: Paleta[] = [
  {
    id: 'institucional',
    nombre: 'Petróleo y ocre',
    fondo: '#14383D',
    fondoOscuro: '#0C2529',
    acento: '#D0A24C',
    acentoClaro: '#E6C88B',
    claro: '#F4F1EA',
  },
  {
    id: 'grafito',
    nombre: 'Grafito',
    fondo: '#23272C',
    fondoOscuro: '#15181C',
    acento: '#AEBAC3',
    acentoClaro: '#D2DAE0',
    claro: '#F1F3F5',
  },
  {
    id: 'rosa',
    nombre: 'Rosa vino',
    fondo: '#63302f',
    fondoOscuro: '#4a2123',
    acento: '#f2a2a2',
    acentoClaro: '#f7bdbd',
    claro: '#fbefea',
  },
  {
    id: 'noche',
    nombre: 'Azul noche',
    fondo: '#1e3a5f',
    fondoOscuro: '#152840',
    acento: '#84bde0',
    acentoClaro: '#b3d8ef',
    claro: '#eef6fb',
  },
  {
    id: 'bosque',
    nombre: 'Verde bosque',
    fondo: '#25402f',
    fondoOscuro: '#182b20',
    acento: '#8fd0a2',
    acentoClaro: '#b7e2c3',
    claro: '#f0f7ef',
  },
  {
    id: 'dorado',
    nombre: 'Negro y dorado',
    fondo: '#201d18',
    fondoOscuro: '#141210',
    acento: '#d9ba45',
    acentoClaro: '#ecd28b',
    claro: '#f8f3e6',
  },
  {
    id: 'morado',
    nombre: 'Morado uva',
    fondo: '#3b2352',
    fondoOscuro: '#28173a',
    acento: '#c39ae6',
    acentoClaro: '#dcc2f2',
    claro: '#f5eefc',
  },
  {
    id: 'naranja',
    nombre: 'Terracota',
    fondo: '#7a3b1e',
    fondoOscuro: '#582815',
    acento: '#f2b189',
    acentoClaro: '#f8cfb4',
    claro: '#fdf1e8',
  },
  {
    id: 'menta',
    nombre: 'Menta',
    fondo: '#14403c',
    fondoOscuro: '#0b2a27',
    acento: '#6fd1b4',
    acentoClaro: '#a6e6d3',
    claro: '#eff8f4',
  },
  {
    id: 'cafe',
    nombre: 'Café con leche',
    fondo: '#3b2a21',
    fondoOscuro: '#261a14',
    acento: '#d8a97a',
    acentoClaro: '#edc9a3',
    claro: '#f8f0e7',
  },
  {
    id: 'indigo',
    nombre: 'Índigo',
    fondo: '#2a2a5e',
    fondoOscuro: '#1b1b40',
    acento: '#a9a6f0',
    acentoClaro: '#cbc9f7',
    claro: '#f1f0fd',
  },
  {
    id: 'cereza',
    nombre: 'Cereza',
    fondo: '#5c1220',
    fondoOscuro: '#3e0b16',
    acento: '#f09aa8',
    acentoClaro: '#f7c0c8',
    claro: '#fdeff1',
  },
  {
    id: 'oceano',
    nombre: 'Océano',
    fondo: '#0f3a4d',
    fondoOscuro: '#082733',
    acento: '#6ec6de',
    acentoClaro: '#a7deec',
    claro: '#edf7fa',
  },
  {
    id: 'arena',
    nombre: 'Arena y oliva',
    fondo: '#4a4526',
    fondoOscuro: '#322e19',
    acento: '#d6ce7e',
    acentoClaro: '#e8e3ae',
    claro: '#f8f6e9',
  },
];

export type Tipografia = {
  id: string;
  nombre: string;
  titulos: string;
  texto: string;
  /** Parámetro `family` de Google Fonts para cargar solo lo que se usa. */
  google: string;
};

export const TIPOGRAFIAS: Tipografia[] = [
  {
    id: 'institucional',
    nombre: 'Institucional',
    titulos: "'Source Serif 4', Georgia, serif",
    texto: "'IBM Plex Sans', system-ui, sans-serif",
    google: 'family=Source+Serif+4:ital,wght@0,600;0,700;1,600&family=IBM+Plex+Sans:wght@400;500;600',
  },
  {
    id: 'clasica',
    nombre: 'Clásica',
    titulos: "'Playfair Display', Georgia, serif",
    texto: "'Montserrat', system-ui, sans-serif",
    google: 'family=Playfair+Display:ital,wght@0,700;1,700&family=Montserrat:wght@400;500;600',
  },
  {
    id: 'elegante',
    nombre: 'Elegante',
    titulos: "'Cormorant Garamond', Georgia, serif",
    texto: "'Lato', system-ui, sans-serif",
    google: 'family=Cormorant+Garamond:ital,wght@0,700;1,700&family=Lato:wght@400;700',
  },
  {
    id: 'moderna',
    nombre: 'Moderna',
    titulos: "'DM Serif Display', Georgia, serif",
    texto: "'Inter', system-ui, sans-serif",
    google: 'family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;600',
  },
  {
    id: 'fuerte',
    nombre: 'Fuerte',
    titulos: "'Anton', Impact, sans-serif",
    texto: "'Oswald', system-ui, sans-serif",
    google: 'family=Anton&family=Oswald:wght@400;600',
  },
];

export const paletaPorId = (id: string): Paleta => PALETAS.find((p) => p.id === id) ?? PALETAS[0];

export const tipografiaPorId = (id: string): Tipografia =>
  TIPOGRAFIAS.find((t) => t.id === id) ?? TIPOGRAFIAS[0];

export function urlGoogleFonts(tipografia: Tipografia): string {
  return `https://fonts.googleapis.com/css2?${tipografia.google}&display=swap`;
}
