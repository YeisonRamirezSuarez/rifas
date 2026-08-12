/**
 * Fondos decorativos del póster. Todos monocromáticos: pintan con
 * `currentColor`, así heredan el acento de la paleta y nunca chocan con ella.
 * El contenedor `.florituras` pone color, opacidad y recorte.
 */

type Props = { className?: string };

/* ---------- piezas de esquina (se colocan por CSS) ---------- */

function Esquinas({ Pieza }: { Pieza: (p: Props) => JSX.Element }) {
  return (
    <>
      <Pieza className="florituras__pieza florituras__pieza--sd" />
      <Pieza className="florituras__pieza florituras__pieza--ii" />
      <Pieza className="florituras__pieza florituras__pieza--di" />
    </>
  );
}

function RamaBotanica({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 220 300" fill="none" stroke="currentColor">
      <defs>
        <g id="hoja" strokeWidth="2" strokeLinecap="round">
          <path d="M0 0C16-18 48-20 66 0 48 20 16 18 0 0Z" />
          <path d="M4 0C22 3 44 3 62 0" />
          <path d="M18-9 26-1M32-11 40-2M46-10 53-2M18 9 26 1M32 11 40 2M46 10 53 2" />
        </g>
        <g id="flor" strokeWidth="2" strokeLinecap="round">
          <path d="M0-26C12-26 18-14 0 0-18-14-12-26 0-26Z" />
          <path d="M0-26 0-4" />
        </g>
      </defs>
      <path strokeWidth="2.4" strokeLinecap="round" d="M214 6C176 44 150 92 132 142c-16 44-40 88-84 122" />
      <path strokeWidth="1.6" strokeLinecap="round" d="M150 96c-30 6-56 26-70 54M120 168c26 4 52-4 72-22" />
      <use href="#hoja" transform="translate(150 96) rotate(196) scale(1.15)" />
      <use href="#hoja" transform="translate(158 74) rotate(-28)" />
      <use href="#hoja" transform="translate(120 168) rotate(-24) scale(1.05)" />
      <use href="#hoja" transform="translate(112 186) rotate(150) scale(0.9)" />
      <use href="#hoja" transform="translate(70 240) rotate(200) scale(1.1)" />
      <use href="#hoja" transform="translate(84 224) rotate(-14) scale(0.85)" />
      <use href="#hoja" transform="translate(190 34) rotate(168) scale(0.8)" />
      <g transform="translate(58 196)">
        {[0, 72, 144, 216, 288].map((g) => (
          <use key={g} href="#flor" transform={`rotate(${g})`} />
        ))}
        <g strokeWidth="1.4" strokeLinecap="round">
          <path d="M0 0-14-26M0 0 4-30M0 0 18-24" />
          <circle cx="-14" cy="-28" r="2.6" />
          <circle cx="4" cy="-32" r="2.6" />
          <circle cx="19" cy="-26" r="2.6" />
        </g>
      </g>
    </svg>
  );
}

/** Monstera calada + palma con foliolos + helecho. */
function Follaje({ className }: Props) {
  const foliolos = Array.from({ length: 11 }, (_, i) => i);
  return (
    <svg className={className} viewBox="0 0 220 300" fill="none" stroke="currentColor">
      <defs>
        <g id="monstera" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M0 0C-6-34 14-64 46-74c30-9 56 4 62 26 6 24-10 50-40 62C38 24 6 22 0 0Z" />
          <path strokeWidth="1.5" d="M2-6C22-22 48-38 92-46" />
          <path strokeWidth="1.5" d="M8-22c14-6 26-16 32-30M16 2c16-4 32-14 40-28M34 10c14-6 28-18 34-32M54 12c12-8 22-20 26-32" />
          <path strokeWidth="1.5" fill="none" d="M22-46c8-6 14-14 16-22M44-52c8-6 14-13 17-21M66-50c6-6 11-12 14-19" />
        </g>
        <g id="helecho" strokeWidth="1.5" strokeLinecap="round">
          <path strokeWidth="2" d="M0 0C14-16 30-30 52-40" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={i} d={`M${i * 7.5} ${-i * 6}c4-8 3-16-2-21`} />
          ))}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={i} d={`M${i * 7.5} ${-i * 6}c8-2 14-8 16-16`} />
          ))}
        </g>
      </defs>

      {/* palma: raquis + foliolos a ambos lados */}
      <path strokeWidth="2.6" strokeLinecap="round" d="M206 4C168 44 142 96 128 154c-8 32-12 66-12 100" />
      <g strokeWidth="1.8" strokeLinecap="round">
        {foliolos.map((i) => {
          const x = 200 - i * 8.2;
          const y = 16 + i * 15;
          const largo = 40 - Math.abs(i - 5) * 3;
          return (
            <g key={i}>
              <path d={`M${x} ${y}c-${largo * 0.7}-6-${largo}-2-${largo * 1.1} ${largo * 0.5}`} />
              <path d={`M${x} ${y}c${largo * 0.5}-10 ${largo * 0.8}-8 ${largo}-2`} />
            </g>
          );
        })}
      </g>

      <use href="#monstera" transform="translate(30 236) rotate(-14) scale(1.05)" />
      <use href="#helecho" transform="translate(150 292) rotate(-24)" />
      <use href="#helecho" transform="translate(196 96) rotate(150) scale(0.85)" />
      <circle cx="104" cy="212" r="3" fill="currentColor" stroke="none" />
      <circle cx="118" cy="228" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Art déco: abanico de rayos, arcos escalonados y perlas. */
function ArcosDeco({ className }: Props) {
  const rayos = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg className={className} viewBox="0 0 220 300" fill="none" stroke="currentColor">
      {/* abanico de rayos desde la esquina */}
      <g strokeWidth="1.6" strokeLinecap="round">
        {rayos.map((i) => {
          const a = (i / (rayos.length - 1)) * (Math.PI / 2);
          return (
            <line
              key={i}
              x1={214 - Math.cos(a) * 34}
              y1={10 + Math.sin(a) * 34}
              x2={214 - Math.cos(a) * 96}
              y2={10 + Math.sin(a) * 96}
            />
          );
        })}
      </g>
      <g strokeWidth="2.4">
        {[34, 62, 100, 140].map((r, i) => (
          <path key={r} d={`M${214 - r} 10a${r} ${r} 0 00${r} ${r}`} strokeWidth={i % 2 ? 1.4 : 2.6} />
        ))}
      </g>
      <g fill="currentColor" stroke="none">
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 4) * (Math.PI / 2);
          return <circle key={i} cx={214 - Math.cos(a) * 118} cy={10 + Math.sin(a) * 118} r="3.2" />;
        })}
      </g>

      {/* arcos escalonados abajo a la izquierda */}
      <g strokeWidth="2.4">
        {[30, 54, 78, 102].map((r, i) => (
          <path key={r} d={`M6 ${292 - r}a${r} ${r} 0 00${r} ${r}`} strokeWidth={i % 2 ? 1.4 : 2.6} />
        ))}
      </g>
      <g strokeWidth="2" strokeLinecap="round">
        <path d="M6 300v-24h18M6 262v-18h30M6 230v-14h42" />
      </g>
      <g fill="currentColor" stroke="none">
        <circle cx="30" cy="268" r="2.6" />
        <circle cx="52" cy="248" r="2.2" />
        <circle cx="74" cy="232" r="2.6" />
      </g>
    </svg>
  );
}

/**
 * Ornamento de esquina del marco, dibujado para la de arriba a la izquierda.
 * Las otras tres son la misma pieza espejada por CSS: un marco tiene que
 * cerrar igual por los cuatro lados o se lee como un paréntesis suelto.
 *
 * Los dos brazos son el mismo trazo reflejado en la diagonal (`matrix(0 1 1 0
 * 0 0)`), así el ángulo sale simétrico sin dibujarlo dos veces.
 */
function MarcoEsquina({ className }: Props) {
  return (
    <svg className={className} viewBox="0 0 130 130" fill="none" stroke="currentColor">
      <defs>
        <g id="marco-voluta" strokeWidth="2.2" strokeLinecap="round">
          <path d="M34 15c19 0 35 5 45 15 6 7 5 16-3 19-7 2-13-2-13-8 0-5 4-9 9-9 7 0 12 6 12 14" />
          <path strokeWidth="1.1" d="M36 22c13 1 25 5 33 12" />
        </g>
        <g id="marco-perlas" fill="currentColor" stroke="none">
          <circle cx="98" cy="15" r="2.8" />
          <circle cx="109" cy="15" r="2.1" />
          <circle cx="118" cy="15" r="1.5" />
        </g>
        <g id="marco-hoja" strokeWidth="1.6" strokeLinecap="round">
          <path d="M0 0C9-4 17-2 22 6 13 10 5 8 0 0Z" />
          <path strokeWidth="1" d="M3 1c6-1 12 1 16 5" />
        </g>
      </defs>

      {/* rosetón de la esquina: cuatro pétalos y perla al centro */}
      <g strokeWidth="1.9">
        <circle cx="17" cy="17" r="10" />
        <path d="M17 8c4 5 4 8 0 9-4-1-4-4 0-9zM17 26c-4-5-4-8 0-9 4 1 4 4 0 9zM8 17c5-4 8-4 9 0-1 4-4 4-9 0zM26 17c-5 4-8 4-9 0 1-4 4-4 9 0z" />
      </g>
      <circle cx="17" cy="17" r="2.4" fill="currentColor" stroke="none" />

      {/* los dos brazos, uno reflejado en la diagonal */}
      <use href="#marco-voluta" />
      <use href="#marco-voluta" transform="matrix(0 1 1 0 0 0)" />
      <use href="#marco-perlas" />
      <use href="#marco-perlas" transform="matrix(0 1 1 0 0 0)" />

      {/* palmeta apuntando al centro del póster, sobre la diagonal */}
      <g transform="translate(46 46) rotate(45)">
        <g strokeWidth="1.9" strokeLinecap="round">
          <path d="M0-16C8-16 12-7 0 5-12-7-8-16 0-16Z" />
          <path strokeWidth="1.2" d="M0-12v14" />
        </g>
        <use href="#marco-hoja" transform="translate(-4 2) rotate(160)" />
        <use href="#marco-hoja" transform="translate(4 2) rotate(20) scale(-1 1)" />
      </g>

      {/* remates que enganchan la voluta con el filete */}
      <g fill="currentColor" stroke="none">
        <circle cx="34" cy="15" r="2.4" />
        <circle cx="15" cy="34" r="2.4" />
      </g>
    </svg>
  );
}

/**
 * Marco de verdad: los tramos rectos son bordes CSS, que no se deforman nunca,
 * y las cuatro esquinas son la misma pieza espejada. Antes eran dos ornamentos
 * en esquinas opuestas y sin borde entre ellos: no cerraba, y por eso se leía
 * como un adorno suelto en vez de un marco.
 */
function Marco() {
  return (
    <>
      <span className="marco__filete" />
      <MarcoEsquina className="marco__esquina marco__esquina--si" />
      <MarcoEsquina className="marco__esquina marco__esquina--sd" />
      <MarcoEsquina className="marco__esquina marco__esquina--id" />
      <MarcoEsquina className="marco__esquina marco__esquina--ii" />
    </>
  );
}

/* ---------- patrones que cubren todo el póster ---------- */

/** slice + viewBox fijo: el motivo escala parejo y no se deforma con el póster. */
function Patron({
  id,
  tile,
  alto = tile,
  children,
}: {
  id: string;
  tile: number;
  /** Alto de la baldosa. Por defecto cuadrada; las escamas la quieren baja. */
  alto?: number;
  children: JSX.Element;
}) {
  return (
    <svg
      className="florituras__patron"
      viewBox="0 0 600 1000"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
    >
      <defs>
        <pattern id={id} width={tile} height={alto} patternUnits="userSpaceOnUse">
          {children}
        </pattern>
      </defs>
      <rect width="600" height="1000" fill={`url(#${id})`} stroke="none" />
    </svg>
  );
}

const punto = (cx: number, cy: number, r: number) => (
  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />
);

/** Serpentinas rizadas, triángulos, garabatos y perlas. */
const Confeti = () => (
  <Patron id="p-confeti" tile={120}>
    <g strokeWidth="2.2" strokeLinecap="round">
      <path d="M8 18c8-8 16 8 24 0s16 8 24 0" />
      <path d="M70 96c8-8 16 8 24 0s16 8 24 0" />
      <path d="M96 26c-6 8-4 18 4 24s10 16 4 24" />
      <path d="M22 74c6 8 4 18-4 24" />
      <path d="M52 44l10-10M108 62l8-8M36 108l8-8" />
      <path d="M78 12l9 5-9 5-3-5 3-5z" />
      <path d="M14 46l9 5-9 5-3-5 3-5z" transform="rotate(38 18 51)" />
      <path d="M58 84l9 5-9 5-3-5 3-5z" transform="rotate(-24 62 89)" />
      {[
        [40, 20, 3],
        [104, 44, 2.4],
        [16, 96, 3],
        [86, 112, 2.4],
        [64, 62, 2.8],
        [116, 100, 2.2],
      ].map(([x, y, r]) => punto(x, y, r))}
    </g>
  </Patron>
);

/** Destellos de cuatro puntas en tres tamaños, con anillos y polvo. */
const Destellos = () => {
  const brillo = (x: number, y: number, s: number, g = 0) => (
    <path
      key={`${x}-${y}`}
      d="M0-14C2-5 5-2 14 0 5 2 2 5 0 14-2 5-5 2-14 0-5-2-2-5 0-14z"
      fill="currentColor"
      stroke="none"
      transform={`translate(${x} ${y}) rotate(${g}) scale(${s})`}
    />
  );
  return (
    <Patron id="p-destellos" tile={130}>
      <g>
        {brillo(28, 26, 1.15)}
        {brillo(92, 62, 0.8, 12)}
        {brillo(54, 100, 0.6)}
        {brillo(116, 116, 0.95, -10)}
        {brillo(8, 88, 0.5)}
        <g strokeWidth="1.6">
          <circle cx="104" cy="20" r="9" />
          <circle cx="20" cy="118" r="6" />
          <circle cx="70" cy="46" r="3.5" />
        </g>
        {[
          [46, 58, 2],
          [128, 82, 1.8],
          [86, 128, 2],
          [12, 48, 1.6],
        ].map(([x, y, r]) => punto(x, y, r))}
      </g>
    </Patron>
  );
};

/** Lunares en tres tamaños, escalonados, con anillos finos. */
const Lunares = () => (
  <Patron id="p-lunares" tile={110}>
    <g>
      <g strokeWidth="2">
        <circle cx="26" cy="26" r="12" />
        <circle cx="82" cy="72" r="9" />
        <circle cx="94" cy="16" r="5" />
        <circle cx="14" cy="82" r="6.5" />
      </g>
      <g strokeWidth="1.2">
        <circle cx="26" cy="26" r="5" />
        <circle cx="82" cy="72" r="3.5" />
      </g>
      {[
        [56, 48, 3.2],
        [52, 6, 2.2],
        [6, 52, 2.2],
        [104, 100, 3],
        [58, 100, 2],
        [100, 46, 2],
      ].map(([x, y, r]) => punto(x, y, r))}
    </g>
  </Patron>
);

/** Tres ondas de distinto grosor y amplitud, con burbujas entre medio. */
const Ondas = () => (
  <Patron id="p-ondas" tile={120}>
    <g strokeLinecap="round">
      <path strokeWidth="2.6" d="M0 24c15-16 30 16 45 0s30 16 45 0 22 8 30 4" />
      <path strokeWidth="1.4" d="M0 40c15-12 30 12 45 0s30 12 45 0 22 6 30 3" />
      <path strokeWidth="2.6" d="M0 84c20-18 40 18 60 0s40 18 60 0" />
      <path strokeWidth="1.4" d="M0 100c20-14 40 14 60 0s40 14 60 0" />
      {[
        [30, 62, 3],
        [78, 66, 2.2],
        [10, 112, 2.4],
        [104, 116, 3],
        [56, 14, 2],
      ].map(([x, y, r]) => punto(x, y, r))}
    </g>
  </Patron>
);

/** Corazones de dos tamaños con brillos y perlas. */
const Corazones = () => {
  const corazon = (x: number, y: number, s: number, g = 0) => (
    <path
      key={`${x}-${y}`}
      d="M0 12c-9-8-16-14-16-22a8 8 0 0116-6 8 8 0 0116 6c0 8-7 14-16 22z"
      strokeWidth={2.2 / s}
      transform={`translate(${x} ${y}) rotate(${g}) scale(${s})`}
    />
  );
  return (
    <Patron id="p-corazones" tile={120}>
      <g>
        {corazon(30, 24, 1)}
        {corazon(88, 76, 0.72, 14)}
        {corazon(102, 20, 0.45, -12)}
        {corazon(16, 92, 0.5, 8)}
        <g strokeWidth="1.4">
          <path d="M62 52l0-8M62 60l0 8M56 56h-8M68 56h8" strokeLinecap="round" />
          <path d="M110 104l0-6M110 110l0 6M105 107h-6M115 107h6" strokeLinecap="round" />
        </g>
        {[
          [56, 100, 2.4],
          [8, 48, 2],
          [116, 60, 2.2],
        ].map(([x, y, r]) => punto(x, y, r))}
      </g>
    </Patron>
  );
};

/** Rombos anidados sobre retícula diagonal fina. */
const Rombos = () => (
  <Patron id="p-rombos" tile={100}>
    <g>
      <g strokeWidth="0.9">
        <path d="M0 50L50 0M50 100L100 50M0 50l50 50M50 0l50 50" />
      </g>
      <g strokeWidth="2.2">
        <path d="M50 12l26 26-26 26-26-26 26-26z" />
        <path d="M50 26l12 12-12 12-12-12 12-12z" />
      </g>
      <g strokeWidth="1.5">
        <path d="M0 88l12 12-12 12-12-12 12-12z" />
        <path d="M100 88l12 12-12 12-12-12 12-12z" />
      </g>
      {[
        [50, 38, 3],
        [4, 4, 2],
        [96, 4, 2],
      ].map(([x, y, r]) => punto(x, y, r))}
    </g>
  </Patron>
);

/** Estrellas de cinco puntas en tres tamaños, con anillos y polvo. */
const Estrellas = () => {
  // Radio 10 por fuera y 4 por dentro: la de cinco puntas necesita las dos
  // vueltas o queda un pentágono.
  const estrella = (x: number, y: number, s: number, g = 0) => (
    <path
      key={`${x}-${y}`}
      d="M0-10 2.35-3.24 9.51-3.09 3.8 1.24 5.88 8.09 0 4-5.88 8.09-3.8 1.24-9.51-3.09-2.35-3.24Z"
      fill="currentColor"
      stroke="none"
      transform={`translate(${x} ${y}) rotate(${g}) scale(${s})`}
    />
  );
  return (
    <Patron id="p-estrellas" tile={120}>
      <g>
        {estrella(28, 30, 1.5)}
        {estrella(92, 74, 1.05, 14)}
        {estrella(104, 20, 0.7, -12)}
        {estrella(56, 104, 0.85, 8)}
        {estrella(12, 88, 0.55)}
        <g strokeWidth="1.5">
          <circle cx="70" cy="46" r="4" />
          <circle cx="20" cy="116" r="3" />
        </g>
        {[
          [54, 62, 2.2],
          [116, 100, 2],
          [86, 128, 1.8],
        ].map(([x, y, r]) => punto(x, y, r))}
      </g>
    </Patron>
  );
};

/**
 * Escamas: arcos concéntricos encajados, como olas de estampa japonesa.
 *
 * La clave es que el radio (30) sea igual al alto de la baldosa y al paso
 * horizontal entre centros: así cada arco toca el borde de arriba justo donde
 * arranca la fila siguiente y se solapa medio motivo con su vecino. Con el
 * paso más ancho no encajan y se leen como filas de arcos sueltos.
 */
const Escamas = () => {
  const R = 30;
  const abanico = (cx: number) => (
    <g key={cx}>
      {[R, 22, 14, 6].map((r, i) => (
        <path key={r} strokeWidth={i % 2 ? 1 : 1.8} d={`M${cx - r} ${R}A${r} ${r} 0 0 1 ${cx + r} ${R}`} />
      ))}
    </g>
  );
  return (
    <Patron id="p-escamas" tile={60} alto={30}>
      {/* de -30 a 90: los de los extremos completan lo que la baldosa vecina
          corta a la mitad */}
      <g strokeLinecap="round">{[-30, 0, 30, 60, 90].map(abanico)}</g>
    </Patron>
  );
};

/** Guirnalda de banderines colgando de un cordón festoneado. */
const Banderines = () => {
  const fila = (y: number, desfase: number) => (
    <g key={y}>
      <path
        strokeWidth="1.8"
        strokeLinecap="round"
        d={`M${desfase - 120} ${y}q10 9 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0`}
      />
      {[10, 30, 50, 70, 90, 110].map((x) => (
        <path
          key={x}
          strokeWidth="2"
          strokeLinejoin="round"
          d={`M${x + desfase - 6} ${y + 4}h12l-6 15z`}
        />
      ))}
    </g>
  );
  return (
    <Patron id="p-banderines" tile={120}>
      <g>
        {fila(18, 0)}
        {fila(78, 60)}
      </g>
    </Patron>
  );
};

/** Retícula fina con cruces en los nudos. La más sobria de todas. */
const Malla = () => (
  <Patron id="p-malla" tile={60}>
    <g>
      <g strokeWidth="0.8">
        <path d="M0 0h60M0 60h60M0 0v60M60 0v60" />
      </g>
      <g strokeWidth="1.6" strokeLinecap="round">
        <path d="M30 24v12M24 30h12" />
        <path d="M0 24v12M-6 30h12" />
        <path d="M60 24v12M54 30h12" />
      </g>
      {[
        [15, 15, 1.6],
        [45, 45, 1.6],
        [45, 15, 1.2],
        [15, 45, 1.2],
      ].map(([x, y, r]) => punto(x, y, r))}
    </g>
  </Patron>
);

/** Laurel: rama de hojas apareadas con bayas, cerrando la esquina. */
function Laurel({ className }: Props) {
  const nudos = Array.from({ length: 12 }, (_, i) => i);
  return (
    <svg className={className} viewBox="0 0 220 300" fill="none" stroke="currentColor">
      <defs>
        <g id="hoja-laurel" strokeWidth="2.2" strokeLinecap="round">
          <path d="M0 0C14-19 42-20 60 0 42 20 14 19 0 0Z" />
          <path strokeWidth="1.3" d="M5 0C22 3 42 3 56 0" />
        </g>
      </defs>
      {/* tallo principal, de la esquina de arriba hacia abajo */}
      <path strokeWidth="3" strokeLinecap="round" d="M210 8C172 50 144 106 130 166c-10 44-14 88-14 126" />
      <g>
        {nudos.map((i) => {
          const t = i / (nudos.length - 1);
          const x = 206 - t * 92;
          const y = 16 + t * 262;
          // Se van achicando hacia abajo: da la sensación de rama que nace en
          // la esquina en vez de una hilera de hojas iguales.
          const e = 1.05 - t * 0.3;
          return (
            <g key={i}>
              <use href="#hoja-laurel" transform={`translate(${x} ${y}) rotate(${152 - t * 26}) scale(${e})`} />
              <use href="#hoja-laurel" transform={`translate(${x} ${y}) rotate(${-38 - t * 22}) scale(${e * 0.92})`} />
            </g>
          );
        })}
      </g>
      {/* bayas: tres por nudo, salteadas, para que la rama no quede plana */}
      <g fill="currentColor" stroke="none">
        {nudos
          .filter((i) => i % 3 === 1)
          .map((i) => {
            const t = i / (nudos.length - 1);
            const x = 206 - t * 92;
            const y = 16 + t * 262;
            return (
              <g key={i}>
                <circle cx={x - 9} cy={y + 12} r="3.4" />
                <circle cx={x - 2} cy={y + 18} r="2.8" />
                <circle cx={x + 6} cy={y + 13} r="2.2" />
              </g>
            );
          })}
        <circle cx="210" cy="8" r="3.6" />
      </g>
    </svg>
  );
}

/* ---------- catálogo ---------- */

export type Fondo = { id: string; nombre: string; Render: () => JSX.Element };

export const FONDOS: Fondo[] = [
  { id: 'botanico', nombre: 'Botánico', Render: () => <Esquinas Pieza={RamaBotanica} /> },
  { id: 'tropical', nombre: 'Tropical', Render: () => <Esquinas Pieza={Follaje} /> },
  { id: 'arcos', nombre: 'Art déco', Render: () => <Esquinas Pieza={ArcosDeco} /> },
  { id: 'marco', nombre: 'Marco', Render: Marco },
  { id: 'confeti', nombre: 'Confeti', Render: Confeti },
  { id: 'destellos', nombre: 'Destellos', Render: Destellos },
  { id: 'lunares', nombre: 'Lunares', Render: Lunares },
  { id: 'ondas', nombre: 'Ondas', Render: Ondas },
  { id: 'corazones', nombre: 'Corazones', Render: Corazones },
  { id: 'rombos', nombre: 'Rombos', Render: Rombos },
  { id: 'estrellas', nombre: 'Estrellas', Render: Estrellas },
  { id: 'escamas', nombre: 'Escamas', Render: Escamas },
  { id: 'banderines', nombre: 'Banderines', Render: Banderines },
  { id: 'malla', nombre: 'Malla', Render: Malla },
  { id: 'laurel', nombre: 'Laurel', Render: () => <Esquinas Pieza={Laurel} /> },
  { id: 'ninguno', nombre: 'Sin fondo', Render: () => <></> },
];

export const fondoPorId = (id: string): Fondo => FONDOS.find((f) => f.id === id) ?? FONDOS[0];

/** Decoración del póster. `id` desconocido cae al botánico. */
export function Florituras({ id }: { id: string }) {
  const { Render } = fondoPorId(id);
  return (
    <div className="florituras" aria-hidden="true">
      <Render />
    </div>
  );
}
