# Perfil — Bug hunt

## Resumen
- Total: 5 bugs (P0: 0, P1: 3, P2: 2)
- Cobertura: direcciones (CRUD, predeterminada), cupones (listado, badge, expiración), métodos de pago (read-only), logout, carrito

## P1

### [PROF-001] Carrito no se limpia al logout
- **Archivo:** `app/(tabs)/profile.tsx:57-61`, `src/stores/auth.ts:68-71`
- **Síntoma:** Usuario A hace logout con 3 artículos en carrito. Usuario B inicia sesión en el mismo dispositivo y ve el carrito de A.
- **Causa raíz:** `logout()` en `auth.ts` no ejecuta `useCartStore.getState().clear()`. El carrito usa AsyncStorage persistente y no está ligado a la sesión.
- **Reproducción:** 
  1. Agregar 2-3 productos al carrito como usuario A
  2. Ir a Perfil → Cerrar Sesión
  3. Iniciar sesión como usuario B
  4. Ir a Carrito → ver productos de usuario A
- **Fix propuesto:** En `src/stores/auth.ts:logout()`, añadir `useCartStore.getState().clear()` después de `removeToken()`.
- **Esfuerzo:** 2 min

### [PROF-002] Badge de cupones desincronizado con realidad
- **Archivo:** `app/(tabs)/profile.tsx:50-55`, `app/profile/cupones.tsx:28-30`
- **Síntoma:** Badge muestra "3 disponibles" pero al entrar a cupones solo hay 2 (uno fue marcado como usado en backend entre renders). Número en badge nunca se actualiza hasta refresh manual.
- **Causa raíz:** `profile.tsx` cachea cupones con `staleTime: 5 * 60 * 1000` (5 min) pero `cupones.tsx` no tiene `staleTime` explícito (default Infinity si no se refetch). Badge no refleja cambios server-side en tiempo real.
- **Reproducción:**
  1. Ver Perfil → badge dice "2 disponibles"
  2. En otra ventana/dispositivo, usuario usa un cupón
  3. Volver a Perfil sin recargar → badge sigue diciendo "2 disponibles" (debería ser 1)
- **Fix propuesto:** Establecer `staleTime: 2 * 60 * 1000` (2 min) en `profile.tsx` query y hacer que `cupones.tsx` refetch al enfocar la tab con `refetchOnFocus: true`.
- **Esfuerzo:** 5 min

### [PROF-003] Eliminación de dirección predeterminada sin validación
- **Archivo:** `app/profile/direcciones.tsx:58-62, 100-134`
- **Síntoma:** Usuario puede eliminar la dirección predeterminada aunque tenga un pedido activo en esa dirección. El pedido queda huérfano sin dirección válida o app crashea al intentar mostrar el pedido.
- **Causa raíz:** `mutEliminar` no valida si la dirección está en uso o es predeterminada. El frontend no tiene lógica para prevenir eliminación de la única dirección o de la predeterminada.
- **Reproducción:**
  1. Crear 1 dirección (se marca predeterminada automáticamente)
  2. Crear un pedido usando esa dirección
  3. Ir a Mis Direcciones → Eliminar → Sí
  4. Ir a Historial de Pedidos → Ver ese pedido → dirección vacía o UI rota
- **Fix propuesto:** Backend debe retornar 409 Conflict si intenta eliminar dirección en uso. Frontend debe mostrar toast: "No puedes eliminar esta dirección, tienes un pedido activo en ella".
- **Esfuerzo:** 10 min

## P2

### [PROF-004] Copy de código referido sin manejo de error
- **Archivo:** `app/(tabs)/profile.tsx:130-131`
- **Síntoma:** Si el usuario deniega permiso de clipboard (Android 11+, muy raro en app instalada pero posible en debug), el copy falla silenciosamente. No hay error toast ni feedback al usuario.
- **Causa raíz:** `Clipboard.setStringAsync()` no tiene try-catch. Si falla (permisos denegados, memoria baja, etc.), la promesa rechazada no se maneja.
- **Reproducción:**
  1. En Android 11+, ir a Settings → App Permissions → Estanco → Clipboard → Deny
  2. Ir a Perfil → click "Copiar" en código referido
  3. No hay toast de error, user confundido si copió o no
- **Fix propuesto:** Envolver en try-catch, mostrar error toast si falla:
  ```tsx
  onPress={() => { 
    try {
      await Clipboard.setStringAsync(cliente.codigo_referido!);
      Toast.show({ type: 'success', text1: 'Código copiado', visibilityTime: 1500 });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'No se pudo copiar', text2: 'Revisa permisos' });
    }
  }}
  ```
- **Esfuerzo:** 3 min

### [PROF-005] Código de cupón con espacios no se trimming en backend validación
- **Archivo:** `app/(tabs)/cart.tsx:366, 82`
- **Síntoma:** Usuario escribe " PROMO " (con espacios), el frontend trimming es correcto (`codigoCupon.trim()`), PERO si backend recibe un código que técnicamente tiene espacios (edge case si API es llamada desde otro cliente), la validación falla. Además, el feedback no es claro si fue por espacios o código inválido.
- **Causa raíz:** Frontend trimea bien, pero UI TextInput con `textTransform: "uppercase"` puede dejar espacios visuales confusos. Si usuario ve código copiado como "PROMO CODE" pero copia "PROMO CODE " (trailing space), podrá entrar una vez pero en un segundo intento fallará porque el código cambió.
- **Reproducción:**
  1. En cupones.tsx, copiar código que tenga caracteres especiales (ej: "SALE-2024")
  2. Ir a carrito, pegar en input
  3. Click Aplicar
  4. Si hay cualquier trailing space en el código copiado, falla con "Cupón no válido" genérico
- **Fix propuesto:** Backend debe normalizador cupones (`.toUpperCase().trim()`) antes de buscar en DB. Frontend toast debe ser específico: "Código no válido o ha expirado" vs "Verifica espacios en blanco".
- **Esfuerzo:** 5 min

## Observaciones

- **Métodos de pago:** Panel es solo informativo (sin integración real), adecuado para fase alpha.
- **Estadísticas de perfil:** `puntos`, `ahorro_total`, `total_pedidos` se actualizan lazy (al crearPedido). Si usuario cambia app antes de que se refetch el perfil, verá datos outdated. Esto es P2 (baja frecuencia, no crítico).
- **BarrioSelector:** Componente bien diseñado. Permite texto libre OR selección de lista. Sin problemas encontrados.
- **Logout sin confirmación visual:** Logout ejecuta sin disable del botón, permite múltiples clicks si red lenta. Agregar `disabled={mutLogout.isPending}` como best practice.

