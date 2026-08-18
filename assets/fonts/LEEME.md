# Fuentes de la app

| Archivo | Uso | Licencia | Estado |
|---|---|---|---|
| `MegionDemo-Bold.otf` | Títulos de sección | **DEMO — pendiente de compra** | ⚠️ NO publicar a tienda así |
| `Oswald-Bold.ttf` | Subtítulos y etiquetas | SIL OFL 1.1 (`Oswald-OFL.txt`) | ✅ uso comercial permitido |

## ⚠️ Megion está en versión de prueba

El archivo que hay aquí es la **demo** que reparte limitype.com. Sirve para ver el
diseño funcionando, pero **no cubre el uso comercial**: Estanco Caquetá Express es
una app que vende, así que antes de mandar una versión a revisión de la App Store
hay que comprar la licencia en https://www.limitype.com y reemplazar el archivo.

Es un reemplazo de un archivo: el nombre de familia que carga `app/_layout.tsx`
no cambia, así que no hay que tocar código.

## Por qué NO está Thunderbold

Era la elegida para subtítulos y se descartó por dos motivos independientes,
cualquiera de los dos suficiente:

1. **No tiene tildes ni ñ.** Son 106 glifos y le faltan `á é í ó ú Á É Í Ó Ú ñ Ñ
   ¿ ¡ ü Ü`. En un catálogo con "Champaña", "Galletas y Ponqués" y "CAQUETÁ" eso
   sale como cuadros vacíos. Y su licencia prohíbe modificarla (cláusula 4), así
   que agregárselos no era una opción. Además es solo mayúsculas.
2. **Licencia Free For Personal Use.** La cláusula 3 nombra explícitamente
   "mobile apps for companies" como uso comercial prohibido.

Oswald la reemplaza: condensada, con acentos completos, y OFL.
