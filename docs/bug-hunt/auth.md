# Auth — Bug hunt

## Resumen
- Total: 9 (P0: 3, P1: 3, P2: 3)
- Cobertura: login, register, OTP, reset password, logout, hydrate, validaciones cliente/servidor

## P0

### [AUTH-001] Race condition: Redirect infinito en _layout después de login
- **Archivo:** `app/(auth)/_layout.tsx:7-9`
- **Síntoma:** Usuario hace login, es redirigido a tabs, pero vuelve a auth. Puede entrar en loop si isAuthenticated cambia durante transición.
- **Causa raíz:** El check `if (isAuthenticated) return <Redirect>` ocurre en cada render sin manejar isLoading. Si hydrate() está progresando, hay estados transitorios conflictivos.
- **Reproducción:** 1) Login rápido, 2) Observe redirecciones inconsistentes antes de completar hydrate.
- **Fix propuesto:** Agregar `if (isLoading) return null` como en tabs/_layout:12. Usar router.replace en lugar de Redirect post-login.
- **Esfuerzo:** trivial

### [AUTH-002] Logout no limpia React Query cache
- **Archivo:** `src/stores/auth.ts:68-71`
- **Síntoma:** Después de logout, datos de pedidos/cupones quedan en caché. Otro usuario vería datos del anterior por 5 min.
- **Causa raíz:** logout() solo limpia SecureStore, no toca queryClient.
- **Reproducción:** 1) Usuario A login + ve cupones, 2) Logout, 3) Usuario B login, 4) Ve cupones de Usuario A si accede antes de 5 min.
- **Fix propuesto:** Llamar queryClient.clear() después de removeToken().
- **Esfuerzo:** trivial

### [AUTH-003] Logout no limpia carrito persistido
- **Archivo:** `src/stores/auth.ts:68-71` vs `src/stores/cart.ts`
- **Síntoma:** Carrito persiste en AsyncStorage. Otro usuario ve items del anterior.
- **Causa raíz:** logout() no llama useCartStore.getState().clear().
- **Reproducción:** 1) Usuario A agrega items y logout, 2) Usuario B login, 3) Ve carrito de A.
- **Fix propuesto:** Agregar useCartStore.getState().clear() en logout().
- **Esfuerzo:** trivial

## P1

### [AUTH-004] Validación teléfono diverge entre cliente y servidor
- **Archivo:** `app/(auth)/register.tsx:41` vs `packages/api/src/routes/clientes.js:33`
- **Síntoma:** Cliente: /^\d{10}$/, Servidor: /^[0-9]{7,15}$/. Usuario rechazado en cliente pero aceptado en servidor.
- **Causa raíz:** Regex desincronizado.
- **Reproducción:** 1) Ingresa teléfono válido pero diferente formato, 2) Error inconsistente.
- **Fix propuesto:** Unificar a ^[0-9]{10}$ en backend.
- **Esfuerzo:** trivial

### [AUTH-005] Hydrate: token persiste si getPerfil timeout, cliente null
- **Archivo:** `src/stores/auth.ts:37-54`
- **Síntoma:** Si getPerfil() timeout, token queda en SecureStore pero estado es null. Siguiente app start no recupera usuario.
- **Causa raíz:** Catch solo borra token si error.message === UNAUTHORIZED. Timeouts no borran.
- **Reproducción:** 1) Usuario logueado, 2) Red lenta, 3) Cierra app durante timeout, 4) Próximo inicio: estado inconsistente.
- **Fix propuesto:** Borrar token en cualquier error, o mantener token y retry.
- **Esfuerzo:** medio

### [AUTH-006] OTP: re-envío sin rate limiting en backend
- **Archivo:** `app/(auth)/verify-otp.tsx:137-141` vs `packages/api/src/routes/clientes.js:10`
- **Síntoma:** Botón reenviar puede spamear. Rate limiter solo cuenta fallos, sucessos libres.
- **Causa raíz:** `skipSuccessfulRequests: true` en loginLimiter.
- **Reproducción:** 1) Oprime reenviar 50 veces, 2) WhatsApp API recibe 50 requests.
- **Fix propuesto:** Cambiar `skipSuccessfulRequests: false` para /reset-password/solicitar.
- **Esfuerzo:** medio

### [AUTH-007] Reset password: OTP race condition reuso de código
- **Archivo:** `packages/api/src/routes/clientes.js:357-390`
- **Síntoma:** Dos requests simultáneos con mismo OTP pueden ambos pasar validación.
- **Causa raíz:** Check y UPDATE no atomic. Sin SELECT...FOR UPDATE.
- **Reproducción:** 1) Envía 2 requests concurrent con mismo código, 2) Ambos actualizan password.
- **Fix propuesto:** Usar transacción SERIALIZABLE o SELECT...FOR UPDATE.
- **Esfuerzo:** medio

## P2

### [AUTH-008] Parámetro telefono undefined en verify-otp
- **Archivo:** `app/(auth)/verify-otp.tsx:10,47,61`
- **Síntoma:** Si navega a /verify-otp sin parámetro, telefono es undefined. Crash en línea 47.
- **Causa raíz:** No valida telefono antes de usar.
- **Reproducción:** 1) Deep link a /verify-otp sin param, 2) Crash.
- **Fix propuesto:** Agregar `if (!telefono) return <Redirect href="/(auth)/forgot-password" />`.
- **Esfuerzo:** trivial

### [AUTH-009] Año nacimiento: rango permite escritura de año inválido
- **Archivo:** `src/components/DateSelector.tsx:79-95`
- **Síntoma:** User escribe año 2009 (17 años), se borra sin feedback. UX confuso.
- **Causa raíz:** Validación silenciosa, sin Toast.
- **Reproducción:** 1) Intenta ingresar 2009, 2) Se borra sin error visible.
- **Fix propuesto:** Toast cuando año inválido.
- **Esfuerzo:** trivial

### [AUTH-010] Sesiones servidor sin invalidación en logout
- **Archivo:** `packages/api/src/routes/clientes.js` (no hay DELETE /clientes/logout)
- **Síntoma:** No hay endpoint para logout del servidor. Sesión queda en DB indefinidamente (hasta expiración).
- **Causa raíz:** Solo cleanup de expiradas en login, no en logout.
- **Reproducción:** 1) Login, 2) Logout, 3) Token sigue en sesiones_clientes. Si se filtra, puede reusarse.
- **Fix propuesto:** Agregar POST /clientes/logout que invalide current session.
- **Esfuerzo:** medio

## Observaciones

1. **Validaciones**: 3 divergencias cliente/servidor. Crear shared/validation-rules.ts.
2. **401 handling**: Handler resetea store pero no redirige a login. Ventana donde UI visible sin datos.
3. **Push token**: Lógica de envío no visible. Si falla, sin retry.
4. **Perfil queries**: Login devuelve ahorro_total pero GET /perfil puede diferir en campos.

