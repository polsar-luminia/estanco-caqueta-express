// Sistema de diseño "Vibrante" — fuente única de verdad del rediseño 2026.
// Componentes con estilos inline importan de aquí; así el look es consistente
// y cambiar un token actualiza toda la app. Ver mockups aprobados (Vibrante).

export const colors = {
  // --- Marca ---
  green: "#1FAF55",       // verde primario (botones, activos, header)
  greenDeep: "#0F9A48",   // verde profundo (gradiente del header)
  greenInk: "#14803E",    // verde oscuro para texto/enlaces sobre fondo claro
  greenTint: "rgba(31,175,85,0.10)", // relleno suave verde (chips, badges)

  // --- Neutros ---
  ink: "#16241A",         // texto principal (negro con matiz verde)
  muted: "#6E7A6C",       // texto secundario
  faint: "#9AA69A",       // placeholders / terciario
  bg: "#F4F6F3",          // fondo de pantalla
  surface: "#FFFFFF",     // tarjetas y superficies
  // Relleno de las baldosas de categoria. Es el gris de la 1.2.3 (#E8E8E5) y
  // vuelve a proposito: sin el, la baldosa era blanca sobre fondo blanco y la
  // cuadricula no se leia como botones, sino como fotos sueltas flotando.
  baldosa: "#E8E8E5",
  line: "#EBEFE9",        // bordes / hairlines
  lowfill: "#F1F4F0",     // rellenos suaves (chips, botones "ghost")
  strike: "#B2BAAE",      // precio tachado

  // --- Acentos / semánticos ---
  offer: "#F0653F",       // coral — ofertas y descuentos
  pink: "#E0457B",
  purple: "#7C5CFF",
  amber: "#E4A400",
  blue: "#2563EB",
  danger: "#DC2626",
  white: "#FFFFFF",
} as const;

// Colores rotativos para tiles de categoría (grilla multicolor).
export const categoryColors = [
  colors.offer, colors.purple, colors.green, colors.amber, colors.blue, colors.pink,
] as const;

// Tipografia (rediseno del catalogo 1.3.0).
//
// Los alias los define useFonts en app/_layout.tsx. Se usan alias y NO el plugin
// nativo de expo-font a proposito: con el plugin, iOS referencia la fuente por
// su nombre PostScript y Android por el nombre del archivo. Cuando no coinciden,
// el texto sale con la fuente equivocada EN UNA SOLA plataforma — no falla, se
// ve mal en la mitad del parque y nadie lo nota hasta que alguien compara.
//
// Las DOS son SIL OFL: uso comercial permitido y sin pagar. Se descarto Megion
// —que era la referencia del borrador— porque su licencia de app cuesta US$750
// y la version gratuita es una demo que no cubre una app que vende.
export const fuentes = {
  titulo: "ArchivoBlack", // titulos de seccion — display negra
  destacado: "Oswald",    // subtitulos, etiquetas y numeros — condensada
} as const;

export const radii = {
  sm: 8,
  md: 12,
  input: 13,
  card: 16,
  tile: 18,
  pill: 999,
} as const;

// Sombras (React Native: sin spread; se aproxima con opacidad/radio).
export const shadows = {
  // Tarjeta de producto / contenido — profundidad suave.
  //
  // El radio es 6, no 20, y esa cifra sale de una medida, no del gusto: el hueco
  // entre tarjetas de un carril es 12 (medidas.gapCarril), asi que cada tarjeta
  // solo puede derramar 6 hacia cada lado. Con mas, las sombras de dos vecinas
  // se superponen y se SUMAN, pintando una banda mas oscura justo en el medio.
  // Sobre una seccion con fondo propio eso se lee como un segundo gris encima
  // del de la seccion: medido, #F4F6F3 (244,246,243) caia a (226,230,226).
  //
  // Si algun dia se cambia gapCarril, este radio se revisa con el.
  card: {
    shadowColor: "#12281A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  soft: {
    shadowColor: "#12281A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  // Botón primario verde — halo de marca.
  greenBtn: {
    shadowColor: colors.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 4,
  },
} as const;

// Medidas de los carriles horizontales (rediseno del catalogo 1.3.0).
//
// ProductCard usa flex: 1 porque nacio para rejillas de dos columnas; dentro de
// un carril horizontal hay que darle un ancho fijo. Ese ancho estaba inventado
// en cada pantalla: search calcula COL_WIDTH y la ficha de producto usa 160 a
// secas, asi que la misma tarjeta se ve de dos tamanos distintos segun por donde
// se llegue. Aqui hay UNO.
//
// 156 no es arbitrario: en un telefono de 360 dp de ancho (el mas comun de la
// base de usuarios) deja ver dos tarjetas completas y el borde de la tercera,
// que es lo que le dice al pulgar que el carril sigue.
export const medidas = {
  cardCarril: 156,
  gapCarril: 12,
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

// Tipografía: tamaños y pesos base del rediseño.
export const type = {
  h1: { fontSize: 20, fontWeight: "800" as const, letterSpacing: -0.2 },
  title: { fontSize: 15, fontWeight: "800" as const, letterSpacing: -0.1 },
  body: { fontSize: 13.5, fontWeight: "500" as const },
  price: { fontSize: 14, fontWeight: "800" as const },
  label: { fontSize: 12, fontWeight: "900" as const, letterSpacing: 1.2, textTransform: "uppercase" as const },
  meta: { fontSize: 12, fontWeight: "500" as const },
} as const;
