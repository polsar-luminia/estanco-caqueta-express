# Fuentes de la app

| Archivo | Uso | Licencia |
|---|---|---|
| `ArchivoBlack-Regular.ttf` | Títulos de sección | SIL OFL 1.1 (`ArchivoBlack-OFL.txt`) |
| `Oswald-Bold.ttf` | Subtítulos y etiquetas | SIL OFL 1.1 (`Oswald-OFL.txt`) |

Las dos permiten uso comercial y empotrarlas en la app, sin pagar y sin trámite.

## Por qué NO está Megion

Era la del borrador y se veía bien, pero su licencia de app cuesta **US$750**
(nivel "Server/App/Game" de limitype.com). Las baratas de US$21 y US$35 son de
escritorio: sirven para diseñar piezas en Illustrator, no para empotrar la fuente
en un binario.

Y el nivel de app es el que aplica aquí, no uno más barato: en este rediseño los
títulos salen de la base de datos y se cambian desde el admin, así que la app
tiene que poder dibujar **cualquier** texto que le manden. Eso obliga a empotrar
la fuente.

Archivo Black la reemplaza: display negra, acentos y ñ completos, OFL.

## Por qué NO está Thunderbold

Era la elegida para subtítulos y se descartó por dos motivos independientes,
cualquiera de los dos suficiente:

1. **No tiene tildes ni ñ.** Son 106 glifos y le faltan `á é í ó ú Á É Í Ó Ú ñ Ñ
   ¿ ¡ ü Ü`. En un catálogo con "Champaña", "Galletas y Ponqués" y "CAQUETÁ" eso
   sale como cuadros vacíos. Su licencia prohíbe modificarla (cláusula 4), así
   que agregárselos no era una opción. Además es solo mayúsculas.
2. **Licencia Free For Personal Use.** La cláusula 3 nombra explícitamente
   "mobile apps for companies" como uso comercial prohibido.

Oswald la reemplaza: condensada, acentos completos, OFL.

## Cómo se cargan

Con `useFonts` en `app/_layout.tsx`, **no** con el plugin nativo de expo-font.
Con el plugin, iOS referencia la fuente por su nombre PostScript y Android por el
nombre del archivo: cuando no coinciden, el texto sale con la tipografía
equivocada en una sola plataforma. No falla — se ve mal en la mitad del parque.

Los alias (`ArchivoBlack`, `Oswald`) están en `src/constants/theme.ts`.
