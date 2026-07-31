# Notas de la versión 1.2.1 (build 75)

Textos listos para copiar y pegar en cada tienda.

---

## Google Play — "Novedades de esta versión"

> Límite 500 caracteres. Este texto usa 331.

```
Ahora decides tú qué comunicaciones quieres recibir. Al crear tu cuenta puedes
autorizar o no las ofertas y promociones, y cambiar de opinión cuando quieras
desde tu perfil.

Los avisos de tus pedidos y los códigos de verificación siguen llegando siempre:
son parte del servicio.

Además, mejoramos los mensajes de error para que digan qué pasó de verdad.
```

---

## App Store Connect — "Novedades de esta versión"

> Mismo texto, funciona igual para Apple.

```
Ahora decides tú qué comunicaciones quieres recibir. Al crear tu cuenta puedes
autorizar o no las ofertas y promociones, y cambiar de opinión cuando quieras
desde tu perfil.

Los avisos de tus pedidos y los códigos de verificación siguen llegando siempre:
son parte del servicio.

Además, mejoramos los mensajes de error para que digan qué pasó de verdad.
```

---

## TestFlight — "Qué probar" (para los testers internos)

```
1. Crear una cuenta nueva y fijarse en la casilla de ofertas y promociones: no
   viene marcada. Probar las dos opciones.
2. Entrar a Perfil > Notificaciones y cambiar la autorización de mercadeo.
   Revocar debe ser tan fácil como autorizar.
3. Leer Política de Privacidad y Términos: ahora mencionan WhatsApp como canal
   y separan las dos autorizaciones.
4. Iniciar sesión con la contraseña equivocada: el mensaje debe decir "Teléfono
   o contraseña incorrectos" y ofrecer recuperarla, no "Error 401".
5. Aplicar un cupón que no existe: debe decir "Cupon no encontrado", no un
   número de error.
```

---

## Qué entra en esta versión (resumen técnico, no para la tienda)

**Autorización de mercadeo separada (lo principal)**

- La casilla de ofertas y promociones aparece en el registro, sin premarcar, y
  es opcional: no aceptarla no impide comprar.
- El cliente ve y cambia su autorización desde Perfil > Notificaciones.
- Se distinguen dos autorizaciones: tratamiento de datos (indispensable para
  operar la cuenta) y comunicaciones comerciales (opcional).
- Los mensajes operativos —estado del pedido, códigos de verificación— no
  dependen de la autorización de mercadeo y se declaran así explícitamente.

**Textos legales**

- La política declaraba mercadeo solo por notificaciones push, mientras en la
  práctica ya se enviaban campañas y recordatorios de carrito por WhatsApp. Los
  textos nuevos declaran ese canal y separan las finalidades.
- **Siguen marcados como borrador pendiente de revisión jurídica** en los
  comentarios del código. Se publican porque el texto anterior describía una
  realidad que ya no era cierta, no porque estén certificados por un abogado.

**Mensajes de error legibles**

- Se corrigieron los mensajes del backend que la app enmascaraba como
  "Error 401" / "Error 409". El caso más costoso: quien se equivocaba de
  contraseña veía un número y no se enteraba de que podía recuperarla.

**Corrección de cobro (backend, ya en producción)**

- Dos toques rápidos en "Confirmar pedido" podían crear dos pedidos cobrados. Se
  corrigió con un bloqueo por cliente dentro de la transacción.

---

## Dependencias ya verificadas antes de compilar

- Tabla `consentimientos` y endpoints de consentimiento **desplegados en
  producción** (648 filas registradas al momento de compilar).
- 134 pruebas de la app y 334 del backend en verde.
- Flujos E2E pasando en Android (134 pasos) e iOS (160 pasos).

---

## Después de que Apple apruebe

Recordar que la versión mínima soportada (`version_minima` en `configuracion`)
sigue en `1.0.0`, o sea el candado de versión está dormido. Subirlo es una
decisión aparte y solo tiene sentido cuando esta versión ya esté instalada en
una porción grande de la base.
