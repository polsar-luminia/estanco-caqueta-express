// Registro de tipos de seccion de la portada.
//
// ESTA ES LA REGLA QUE HACE QUE EL REDISENO NO EXPLOTE: un tipo que este binario
// no conoce se ignora EN SILENCIO. Sin eso, el dia que el servidor estrene un
// tipo de seccion se rompen todos los binarios ya publicados, y se rompen en la
// primera pantalla que abre la gente. Es el mismo criterio que aplica el backend
// con estadoParaVersion para los estados de pedido.
//
// Por eso `tipo` es string y no una union, y por eso el default del switch
// devuelve null en vez de lanzar: el caso "no lo conozco" es esperado, no un
// error.

import { View, Text } from "react-native";
import { colors, fuentes } from "../../constants/theme";
import { useRouter } from "expo-router";
import { CarrilProductos } from "../CarrilProductos";
import { CuadriculaCategorias } from "../CuadriculaCategorias";
import { TarjetaDireccion } from "../TarjetaDireccion";
import { SeccionContenedor } from "../SeccionContenedor";
import { HeroSlide, HeroCarousel } from "../HeroBanner";
import { filtrarCategoriasIOS, filtrarProductosIOS, filtrarConProductoIOS } from "../../lib/iosFilters";
import type { SeccionInicio, ProductoEnCarril, CategoriaGrande, Patrocinado } from "../../lib/api";

export const PANTALLA_INICIO = "(tabs)/index";

interface Ctx {
  router: ReturnType<typeof useRouter>;
  direccion: string | null;
  autenticado: boolean;
  // Si la seccion inmediatamente anterior fue un banner, la tarjeta de direccion
  // se monta encima con margen negativo. Cuando no hay banner —porque no habia
  // patrocinados vigentes y el servidor descarto la seccion— tiene que dibujarse
  // sin solaparse, o queda cortada contra el borde de arriba.
  trasBanner: boolean;
}

export function Seccion({ seccion, ctx }: { seccion: SeccionInicio; ctx: Ctx }) {
  const { router } = ctx;

  // `puedeIr` decide si el boton "Ver mas" se DIBUJA; `irA` solo navega.
  //
  // Estaban fundidos en uno y por eso el boton aparecia siempre que la seccion
  // trajera `ver_mas`, aunque `irA` no supiera a donde ir: destino "categoria"
  // sin id (el admin no valida que el id exista), o un destino nuevo que el
  // servidor empiece a mandar y este binario no conozca. El cliente lo tocaba y
  // no pasaba nada — que es justo lo que CarrilProductos dice evitar cuando
  // exige onVerMas para pintarlo.
  const puedeIr = (destino: string | undefined, id: number | null | undefined) =>
    destino === "ofertas" || destino === "busqueda" || (destino === "categoria" && !!id);

  const irA = (destino: string | undefined, id: number | null | undefined) => {
    if (destino === "ofertas") return router.push("/ofertas");
    if (destino === "busqueda") return router.push("/(tabs)/search");
    if (destino === "categoria" && id) return router.push(`/category/${id}`);
  };

  switch (seccion.tipo) {
    case "banner": {
      // Defensa cliente para iOS (Apple §1.4.3): el backend ya filtra por
      // X-Platform, esto cubre un cache vencido o una regresion.
      const banners = filtrarConProductoIOS(seccion.items as Patrocinado[]);
      if (banners.length === 0) return null;
      return (
        // A sangre completa: sin margenes ni esquinas redondeadas, pegado al
        // header. El carrusel conserva sus margenes porque su snap entre
        // diapositivas esta medido contra el ancho con margen.
        <View style={seccion.opciones?.modo === "carousel" ? { marginHorizontal: 16, marginTop: 12 } : undefined}>
          {seccion.opciones?.modo === "carousel" ? (
            <HeroCarousel banners={banners} router={router} />
          ) : (
            <HeroSlide
              banner={banners[0]}
              aSangre
              onPress={() => router.push(banners[0]?.producto?.id ? `/product/${banners[0].producto!.id}` : "/ofertas")}
            />
          )}
        </View>
      );
    }

    case "direccion_entrega":
      return (
        <TarjetaDireccion
          direccion={ctx.direccion}
          autenticado={ctx.autenticado}
          montada={ctx.trasBanner}
          onCambiar={() => router.push(ctx.autenticado ? "/profile/direcciones" : "/(auth)/register")}
        />
      );

    case "categorias": {
      const cats = filtrarCategoriasIOS(seccion.items as CategoriaGrande[]).map((c) => ({
        ...c,
        subcategorias: filtrarCategoriasIOS(c.subcategorias ?? []),
      }));
      if (cats.length === 0) return null;
      return (
        // paddingBottom corto a proposito: debajo viene la franja de la curva,
        // que ya mide 29 pt y en el centro deja ver el blanco casi entero. Con
        // los 18 de antes, el hueco entre la ultima categoria y el magenta
        // llegaba a ~47 pt en la mitad de la pantalla y se veia despegado.
        <View style={{ backgroundColor: colors.surface, paddingTop: 16, paddingBottom: 4 }}>
          {/* El titulo lo manda el servidor (secciones_inicio.titulo) igual que
              en los carriles, y por eso no va quemado: cambiarlo no deberia
              exigir publicar la app. Mismo estilo que "Ofertas" y "Recomendados
              para ti" — con el tamano de la 1.2.3 (18 pt) quedaria al lado de
              uno de 30 y se leeria como un error de diseno, no como jerarquia. */}
          {seccion.titulo ? (
            <Text
              style={{
                fontFamily: fuentes.titulo,
                fontSize: 30,
                color: colors.ink,
                paddingHorizontal: 16,
                marginBottom: 12,
              }}
              numberOfLines={1}
            >
              {seccion.titulo}
            </Text>
          ) : null}
          <CuadriculaCategorias
            categorias={cats}
            onSelect={(id) => router.push(`/category/${id}`)}
          />
        </View>
      );
    }

    case "carril_ofertas":
    case "carril_productos": {
      const productos = filtrarProductosIOS(seccion.items as ProductoEnCarril[]);
      return (
        <SeccionContenedor
          colorFondo={seccion.estilo?.color_fondo}
          bordeSuperior={seccion.estilo?.borde_superior}
        >
          <CarrilProductos
            titulo={seccion.titulo}
            productos={productos}
            origen={seccion.titulo ?? seccion.tipo}
            seccionId={seccion.id}
            destinoVerMas={seccion.ver_mas?.destino}
            colorTexto={seccion.estilo?.color_texto}
            onVerMas={seccion.ver_mas && puedeIr(seccion.ver_mas.destino, seccion.ver_mas.id)
              ? () => irA(seccion.ver_mas!.destino, seccion.ver_mas!.id)
              : undefined}
            onPressProducto={(id) => router.push(`/product/${id}`)}
            pantalla={PANTALLA_INICIO}
          />
        </SeccionContenedor>
      );
    }

    default:
      // Tipo desconocido para este binario. Silencio a proposito: ver cabecera.
      return null;
  }
}
