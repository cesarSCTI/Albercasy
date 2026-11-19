# Filtros nativos de Shopify en colecciones

## Cambios aplicados

- Se reactivó la sección de colección de Wokiee en `templates/collection.json` y se retiraron el bloque de filtros y el contenedor de Boost de esa plantilla. La cuadrícula usa las tarjetas del tema y pagina `collection.products`.
- La barra lateral lee `collection.filters`. Muestra filtros de lista, booleanos y rango de precio, con conteos, muestras de color o imagen cuando Shopify las devuelve, y enlaces para quitar selecciones o limpiar todos los filtros.
- Los filtros y el orden se aplican con formularios GET. La URL guarda las selecciones y al aplicar cambios se vuelve a la primera página. Cambiar el orden conserva los filtros activos. El selector de cantidad ofrece el tamaño configurado en el tema y las vistas de 16, 32 o 50 productos. La antigua etiqueta «Todas» se reemplazó por el límite real de 50.
- La paginación usa los enlaces de Shopify. «Mostrar más» y el desplazamiento automático, según la configuración del tema, añaden productos mediante la Section Rendering API. Si falla la petición, el enlace permite abrir la siguiente página. Los formularios y enlaces de página funcionan sin JavaScript.
- Las colecciones que renderizan la sección nativa omiten el script de filtros por tags y el respaldo de Boost. La configuración global del app embed de Boost, las plantillas de búsqueda, la copia `collection.boost-sd-original.json` y las vistas auxiliares AJAX siguen en el repositorio. La integración nativa se aplica a la plantilla predeterminada y a las tres vistas de cantidad.
- Los estilos nuevos están en `assets/collection-native.css`. Los textos de los controles y mensajes se agregaron a los siete idiomas del tema.

## Revisión en Shopify antes de publicar

1. Abrir la vista previa de una copia del tema y probar una colección que use la plantilla predeterminada. Revisar en el administrador si alguna colección tiene asignada una plantilla alterna.
2. En **Shopify Search & Discovery → Filtros**, comparar los filtros comerciales de Boost con las fuentes disponibles en Shopify. Activar los filtros necesarios y completar los datos de productos si alguna fuente de opciones o metafields carece de valores. Los filtros visibles dependen del catálogo y de lo configurado en la app.
3. Seleccionar dos valores del mismo filtro y combinar filtros de grupos distintos. Probar precio con un solo límite y con ambos, quitar un valor, limpiar todo y comprobar el estado sin resultados.
4. Ordenar, cambiar la cantidad por página, paginar y probar «Mostrar más». Recargar una URL filtrada y usar Atrás y Adelante para comprobar el estado. Repetir en móvil y con JavaScript desactivado. Revisar una tarjeta agregada con «Mostrar más» e interactuar con sus controles.
5. Confirmar que el app embed global de Boost no interviene en colecciones y que la búsqueda conserva el comportamiento esperado. Revisar también los enlaces de colección con tags que se sigan usando. Shopify oculta los filtros nativos en colecciones de más de 5,000 productos.

## Verificación local

Se validaron la sintaxis de JavaScript, los archivos JSON editados y el flujo de «Mostrar más» con respuestas simuladas. La comprobación cubrió la conservación de dos valores del mismo filtro, el orden, la vista y la página, además del fin de la paginación y la recuperación mediante el enlace cuando falla la petición.

La configuración de Search & Discovery, la interacción con el app embed de Boost y el renderizado real en Shopify quedan pendientes de comprobar en la vista previa. Los ajustes se aplicaron localmente. No se hizo push ni se publicó el tema.

- [Filtros nativos en temas Shopify](https://shopify.dev/docs/storefronts/themes/navigation-search/filtering/storefront-filtering/support-storefront-filtering)
- [Configuración y límites de Search & Discovery](https://help.shopify.com/en/manual/online-store/storefront-search/search-and-discovery-filters)
- [Section Rendering API](https://shopify.dev/docs/api/ajax/section-rendering)
