[![Netlify Status](https://api.netlify.com/api/v1/badges/3e33ad8a-b5ce-4be9-b304-d72f0c1d7784/deploy-status)](https://app.netlify.com/projects/cc-payment-calculator/deploys)

# Mi corte: calculador de tarjeta

Aplicación financiera personal en español, hecha con React y Vite, para estimar pagos de tarjetas de crédito en pesos colombianos. El modo invitado no necesita backend; el inicio de sesión con Google y la sincronización con Supabase son opcionales.

## Funcionalidades

- Varias tarjetas con tasas, fechas de corte y condiciones independientes, guardadas en el navegador.
- Tasa mensual vencida (MV) o efectiva anual (EA), convertida a mensual automáticamente.
- Compras a una cuota o diferidas, con fecha, valor original y cuotas pagadas y pendientes.
- Registro Desde extracto con saldo reportado, cuotas pendientes, tasa particular EA, fecha de proceso y primer corte explícito; adecuado para refinanciaciones y abonos que alteran el saldo.
- En compras Desde extracto, separa el interés E.A. incluido en la cuota reportada y permite desglosar mora u otros recargos.
- Un único formulario de compra nueva y una lista separada con edición y eliminación.
- Saldo anterior separado del capital de las compras registradas, sin sumarlo completo al mínimo.
- Desglose de capital, intereses, cargos y abonos; pago mínimo y pago total al corte.
- Cupo total y cupo actual disponible informados por el banco, editables y guardados por tarjeta.
- Pago total pendiente estimad: diferencia entre el cupo total y el cupo actual disponible.
- Campos monetarios con puntos de miles y coma decimal durante la escritura, por ejemplo `1.234.567,89`.
- Proyecciones de 3, 6 y 12 meses, con gráfico y tabla.
- Modo claro y oscuro, diseño adaptable y confirmación antes de eliminar.
- Exportación PDF y CSV de la tarjeta, sus compras y la proyección seleccionada.
- Inicio de sesión opcional con Google, sincronización privada y detección de conflictos entre dispositivos.

## Reglas del cálculo

**Saldo anterior** es el capital que no está desglosado en las compras registradas. Si registras una compra anterior con cuotas pendientes, excluye ese capital del saldo anterior para no contarlo dos veces. No ingreses intereses acumulados como capital: usa los cargos adicionales para importes ya facturados.

Si el saldo anterior copiado del extracto ya incluye intereses o cargos facturados, activa “¿Este saldo ya incluye intereses o cargos?” e indica el importe incluido. Ese monto se separa del capital sujeto a intereses nuevos y se suma una sola vez como cargo del primer corte. Déjalo apagado cuando ingreses solamente capital; el importe separado debe ser menor o igual que el saldo. Los abonos, en cambio, se ingresan por el total efectivamente pagado, incluyendo lo que haya cubierto intereses o mora: se restan como pago y no se les vuelve a calcular interés.

Las compras diferidas usan **capital constante**: valor original dividido entre cuotas totales. El capital pendiente es esa cantidad multiplicada por las cuotas no pagadas. Los intereses mensuales se aplican sobre el capital pendiente, no sobre el valor original durante todo el crédito. Al cambiar el valor o las cuotas se reconstruye la compra con los nuevos datos; no se preserva un historial de extractos ni refinanciaciones. Una tasa particular MV opcional en el editor permite conservar promociones o tasas de datos antiguos; dejarla vacía usa la tasa de la tarjeta.

La próxima cuota comienza en el primer corte posterior o igual a la fecha de compra, más las cuotas ya pagadas; si esa fecha pasó, se proyecta en el próximo corte a partir de la **fecha de cálculo**. Una compra el día de corte entra en ese corte. Para días 29, 30 o 31, los meses más cortos usan su último día sin cambiar el día de corte de los meses siguientes. La fecha de cálculo se guarda como parte del escenario; actualízala al preparar un nuevo corte.

El mínimo estimado incluye las cuotas exigibles, intereses, cargos y una porción del saldo anterior. Esa porción es el mayor entre el porcentaje de capital configurado y el piso en pesos, limitado al saldo. El **5% y la tasa MV del 2% iniciales son ejemplos editables**, no condiciones de un banco ni una regla universal colombiana. Las compras a una cuota se consideran sin intereses por defecto, pero esta condición puede desactivarse.

Los abonos registrados se descuentan del primer corte. La proyección supone cubrir el mínimo restante cada mes. Un abono superior al mínimo reduce primero el saldo anterior y después el capital de las compras en orden de registro. Un excedente superior a toda la deuda se muestra como no aplicado, no como saldo a favor. Los abonos no cambian retroactivamente el interés calculado para el primer mes. No vuelvas a registrar abonos que ya incluiste en las cuotas pagadas.

El **pago total al corte** incluye todo el capital facturable (incluso cuotas futuras de compras ya iniciadas), intereses y cargos del corte, menos abonos; excluye compras cuyo primer corte todavía no llega. El capital pendiente total sí muestra todas las compras registradas. La proyección asume pagos mínimos, no pagos totales, y no marca automáticamente cuotas como pagadas en tus datos.

**Limitaciones:** no calcula mora, cuotas vencidas acumuladas, interés diario, fechas de contabilización, fechas límite de pago, impuestos automáticos ni reglas específicas de cada entidad. El banco puede usar otro esquema de amortización o de asignación de abonos. Contrasta siempre la estimación con tu contrato y extracto.

El **Pago total pendiente estimad** es el cupo total menos el cupo actual disponible. No se suman ni descuentan nuevamente compras, intereses, cargos o abonos. No depende del horizonte de proyección ni modifica el pago mínimo o el pago al corte. Si falta alguno de los cupos, muestra "Sin registrar"; si el disponible supera el cupo total, muestra $0 y una advertencia. No es una cotización bancaria de cancelación del crédito.

El **cupo total** y el **cupo actual disponible** son valores manuales tomados de tu banco. Su diferencia determina el pago total pendiente, pero no sustituye el saldo anterior ni cambia automáticamente con las compras o abonos. Se permite dejarlos vacíos ("Sin registrar"), distinto de un disponible de $0. Se muestra una advertencia si el disponible supera el cupo total, sin alterar los valores ingresados. Ambos cupos y el pago total pendiente se incluyen en PDF y CSV.

Los campos monetarios aceptan importes como `1234567,89` o `1.234.567,89` y muestran puntos como separador de miles y coma como separador decimal, con hasta dos decimales. Los valores se guardan sin separadores de miles y con punto decimal interno para conservar la compatibilidad con el cálculo y los datos anteriores. Las tasas y las cantidades de cuotas mantienen sus controles numéricos.

## Ingresar un extracto

En Agregar movimiento elige **Desde extracto**. Copia cada movimiento con saldo pendiente en su propia fila. Los campos usan los nombres del banco: Valor compra, Plazo, Fecha de transacción, Fecha de proceso, Cuotas pendientes y Saldo pendiente. La tasa particular se ingresa como efectiva anual. Como ejemplo ficticio, `24.5` representa 24,5% EA. Si un extracto utiliza comas de miles, un importe ficticio de `100,000` debe ingresarse como `100000` o `100.000`, no como un decimal.

En este modo no se reconstruye el saldo como valor original dividido entre plazo. El capital pendiente es el **saldo informado**, conservando ajustes, abonos y refinanciaciones. “Valor cuota mes total reportado” se entiende como la cuota total que ya incluye el interés ordinario calculado con la tasa E.A. del movimiento; se resta ese interés para estimar el capital. Si el banco confirma que el importe es solo capital, deja el campo vacío y la estimación divide el saldo entre las cuotas pendientes. El check “¿Incluye mora u otros valores adicionales?” está desactivado por defecto. Actívalo solo si la cuota incluye recargos adicionales y conoce su importe: indícalo en el campo que aparece. Ese valor se resta del capital y se suma una sola vez a cargos en cada cuota proyectada. Si desconoces el recargo, no actives el check para evitar atribuirlo incorrectamente al capital. La última cuota ajusta cualquier diferencia de redondeo. No se infieren cuotas pagadas desde el plazo: cuotas facturadas y cuotas pagadas no son lo mismo.

**Primer corte a proyectar** indica cuándo empieza a pagarse el saldo que copiaste. Si el saldo pendiente excluye la cuota ya facturada, selecciona el siguiente corte para proyectar ese saldo. Esto no supone que hayas pagado la cuota actual: si sigue exigible, hay que contabilizarla por separado o usar un saldo actualizado del banco. Este modo no reconstruye el pago mínimo exacto del extracto ya emitido.

No agregues el saldo de los movimientos registrados también a Saldo anterior: registra allí solo deuda no desglosada. Las filas con saldo y cuotas pendientes cero no aportan saldo futuro, pero su cuota actual puede estar facturada y todavía sin pagar. Los pagos no son compras; no los vuelvas a descontar si ya están reflejados en los saldos.

## Almacenamiento y migración

En modo invitado, los datos usan `localStorage` con la clave `tarjeta-cuota-calculador-v2` y los cálculos no se envían a un servidor. La tasa se configura una vez por tarjeta; nuevas compras la heredan. El tema y horizonte también se conservan. Las fuentes tipográficas se cargan desde Google Fonts.

Con la integración opcional, Supabase Auth conserva la identidad de inicio de sesión de Google y Supabase PostgreSQL guarda los escenarios de cálculo de la cuenta. La identidad y los cálculos financieros son datos sensibles. Nunca ingreses números de tarjeta, CVV, fechas de vencimiento ni contraseñas bancarias, tampoco en nombres o descripciones: el esquema rechaza claves no permitidas, pero no detecta secretos escritos en texto libre. No hay conexión con bancos ni procesamiento de pagos.

Iniciar sesión no importa automáticamente los escenarios de invitado. La importación requiere una elección explícita, agrega los escenarios a la cuenta y conserva los datos originales del invitado. La caché por cuenta permite consultar y exportar datos ya confirmados sin conexión, en modo solo lectura y con la aplicación ya cargada; no es una PWA ni garantiza abrir la aplicación sin red. La sincronización consulta cambios cada 20 segundos y al recuperar el foco o la conexión. Si hay un conflicto, exporta el borrador antes de recargar los datos de la nube: la recarga descarta cambios pendientes y no hay una opción de sobrescritura forzada.

El guardado en la nube es **manual**: editar no envía datos a Supabase. Cuando hay cambios aparece una barra persistente con **Sincronizar cambios** y **Descartar**. Sincronizar envía una instantánea validada; si continúas editando durante el envío, los cambios posteriores requieren otra sincronización. Descartar pide confirmación y restaura la última versión confirmada sin escribir en la nube. Un fallo conserva el borrador para reintentar; un conflicto requiere revisar/exportar y cargar la versión guardada. Las consultas de fondo no bloquean los campos y no reemplazan un borrador pendiente. La aplicación solicita confirmación del navegador al cerrar o recargar con cambios sin sincronizar; los borradores permanecen en memoria y pueden perderse si abandonas la página. El modo invitado mantiene el guardado automático local. Inicializar una cuenta vacía e importar datos son operaciones explícitas que sí guardan inmediatamente.

PDF y CSV contienen los datos del escenario, las compras y los meses elegidos. CSV usa UTF-8 con BOM, separador `;`, valores numéricos sin formato monetario y protección contra fórmulas en nombres y descripciones.

## Supabase y Google opcionales

Sin variables de Supabase, la aplicación funciona localmente como invitado. Para habilitar cuentas y sincronización:

1. Crea un proyecto de Supabase. Aplica las migraciones de `supabase/migrations/` en orden con Supabase CLI. En una base existente que ya aplicó las anteriores, ejecuta [supabase/migrations/003_previous_balance_charges.sql](supabase/migrations/003_previous_balance_charges.sql); amplía el validador para permitir el desglose de intereses/cargos del saldo anterior sin recrear la tabla ni borrar workspaces. La migración inicial crea la tabla, sus restricciones, RLS de lectura por propietario y el RPC de guardado con control de versión. Los clientes autenticados no pueden hacer INSERT, UPDATE ni DELETE directos.
2. En Google Cloud configura la pantalla de consentimiento y un cliente OAuth de tipo **Aplicación web**. Si la aplicación es externa y está en pruebas, agrega las cuentas de prueba y revisa sus requisitos de publicación. En **URIs de redireccionamiento autorizados** del cliente registra exactamente `https://<project-ref>.supabase.co/auth/v1/callback`, usando el callback que muestra Supabase. Este callback de Google no es la URL de Netlify ni la del servidor Vite.
3. En Supabase, **Authentication > Sign In / Providers > Google**, habilita Google e ingresa el client ID y el client secret del cliente OAuth. El secreto va únicamente en ese panel de Supabase: nunca en variables de Vite o Netlify, archivos del repositorio, logs ni chat.
4. En **Authentication > URL Configuration**, configura **Site URL** como `https://cc-payment-calculator.netlify.app/` y registra estos destinos raíz exactos en **Redirect URLs**, sin comodines ni rutas adicionales:

   ```text
   http://localhost:5173/
   http://127.0.0.1:5173/
   https://cc-payment-calculator.netlify.app/
   ```

   Si tu sitio Netlify tiene otro dominio, sustituye el dominio de producción en ambos lugares. El cliente vuelve al origen raíz del navegador. Si Vite usa otro puerto o pruebas el preview, agrega expresamente su URL raíz exacta (por ejemplo `http://localhost:4173/`); `localhost` y `127.0.0.1` son destinos distintos.

5. Configura localmente en `.env.local` y en las variables del sitio Netlify solo estos valores públicos:

   ```dotenv
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<clave-publica>
   ```

   También se admite una clave pública `anon` heredada. Estas variables quedan visibles en el JavaScript del navegador; nunca uses una clave `service_role`, `sb_secret_...` ni el secreto OAuth. Reinicia Vite después de cambiarlas y genera un nuevo build/despliegue en Netlify.

6. Si actualizas un proyecto Supabase que ya aplicó la migración inicial, aplica también [supabase/migrations/002_statement_payment_breakdown.sql](supabase/migrations/002_statement_payment_breakdown.sql). Solo amplía la allowlist de campos de movimientos; no recrea la tabla ni borra workspaces existentes.
7. Con cuentas y escenarios ficticios, comprueba el recorrido Google completo en local y en el sitio publicado, la separación entre cuentas y la conservación del modo invitado. Las pruebas automatizadas de este repositorio no configuran ni prueban Google Cloud, el proveedor real de Supabase, sus redirects, correo de identidad ni el despliegue de Netlify.

El guardado usa compare-and-swap (CAS): crea el workspace con versión 1 solo cuando la versión esperada es 0, y cada actualización exige la versión actual e incrementa `version` en 1. `schema_version` permanece en 1. Los guardados obsoletos se rechazan. La eliminación completa del workspace de la cuenta no está disponible en la aplicación ni mediante un RPC; tampoco se permite DELETE directo a los clientes. La eliminación de una cuenta de Supabase Auth queda fuera de esta aplicación y corresponde a la administración por otros medios; no se ofrece un flujo ni una garantía de eliminación de cuenta desde aquí.

## Estructura del proyecto

La aplicación usa una estructura por funcionalidades. React no exige una estructura única; esta organización separa los componentes reutilizables, los datos financieros y la coordinación de la aplicación sin añadir un framework ni un gestor de estado adicional.

```text
src/
   main.jsx                       # Montaje de React y estilos globales
   app/
      App.jsx                      # Composición y navegación de vistas
      useWorkspace.js              # Estado, persistencia y acciones del workspace
      WorkspaceDialogs.jsx         # Formularios y confirmaciones modales
   components/
      layout/Header.jsx            # Cabecera de la aplicación
      ui/                          # Field, FieldLabel, FieldHelp, Modal, etc.
   data/fieldHelp.js               # Explicaciones y ejemplos de los campos
   lib/supabase.js                 # Cliente público opcional de Supabase
   features/
      auth/                        # Acceso Google y controles de cuenta
      sync/                        # Validación, caché, importación y guardado versionado
      cards/
         components/                # CardSidebar y CardSettings
         services/                  # Almacenamiento, migración y sus pruebas
      purchases/
         components/                # PurchaseFields y PurchaseList
         model/purchase.js          # Valores iniciales de movimientos
      calculator/
         components/                # Overview, PaymentSummary, Projection y gráfico
         model/                     # Motor financiero y pruebas colocadas
         services/exports.js        # Exportación PDF y CSV
   styles/index.css               # Tema, estilos globales y responsive
   utils/date.js                  # Presentación de fechas
```

Los componentes compartidos no administran tarjetas ni compras. Las vistas reciben datos y acciones por props; `useWorkspace` concentra su coordinación y conserva las mismas claves y formatos de `localStorage`. Las pruebas del motor y del almacenamiento están junto a las implementaciones que validan y se ejecutan con `npm test`.

## Ejecutar localmente

Requiere una versión LTS de Node.js compatible con Vite, npm y un navegador moderno. Ejecuta los comandos desde la raíz del proyecto.

Instala las dependencias con el archivo de bloqueo del repositorio:

```bash
npm ci
```

Inicia el servidor de desarrollo:

```bash
npm run dev
```

Abre la URL que indique Vite en la terminal. Normalmente es `http://localhost:5173/`; si ese puerto está ocupado, Vite puede elegir otro. Detén el servidor con `Ctrl+C`.

## Validación automatizada

```bash
npm test
```

Las pruebas ejecutan el motor financiero y la persistencia con `node:test`: separación de saldos, cuotas pagadas, abonos, tasas EA/MV, compras posteriores al corte, meses cortos, cargos y migración.

`npm test` también ejecuta los casos de sincronización y las pruebas SQL. Verifica aislamiento de cuentas, carga inicial sin escrituras, guardado serializado, borradores incompletos, importación confirmada sin repetir datos y conflictos. Las pruebas de UI autenticada con respuestas simuladas no sustituyen el acceso real de Google.

Las pruebas SQL de seguridad usan PostgreSQL embebido en memoria con la dependencia de desarrollo `@electric-sql/pglite`. Desde la raíz, con esa dependencia instalada, ejecútalas directamente:

```bash
node --test supabase/tests/security.test.js
```

Ejecutan la migración real leída desde disco, sin proyecto Supabase, Docker, conexión de red ni datos reales. Simulan `auth.users`, `auth.uid()`, roles `anon`/`authenticated` y claims JWT mediante settings y `SET ROLE`; esto no verifica firmas JWT ni sustituye una prueba del servicio Supabase desplegado. Verifican RLS A/B, propiedad derivada de `auth.uid()` sin parámetro de propietario, denegación de escrituras directas y del RPC de guardado anónimo, claves prohibidas como `cardNumber`, restricciones de tabla y funciones, CAS obsoleto e incremento de versión, ausencia del RPC de eliminación y rechazo de su invocación por clientes autenticados. La base en memoria se destruye al finalizar.

Comprueba también que la aplicación compile correctamente:

```bash
npm run build
```

## Validar el build en local

Después de generar el build, inicia su servidor de vista previa:

```bash
npm run preview
```

Abre la URL que indique Vite, normalmente `http://localhost:4173/`. La vista previa permite revisar el resultado compilado y no requiere un despliegue. Si cambias el código, vuelve a ejecutar `npm run build` para actualizarla. No abras los archivos del build directamente desde el explorador: utiliza este servidor local.

## Comprobación manual

Usa datos ficticios y, preferiblemente, un perfil de navegador separado para no modificar tus tarjetas guardadas.

1. Crea una tarjeta y configura su tasa, día de corte, cupo total y cupo disponible. Comprueba que el total pendiente coincida con la diferencia de cupos.
2. Agrega una compra a una cuota y otra diferida. Comprueba el formato monetario con coma decimal, la lista de compras y la edición de cuotas pagadas y pendientes.
3. Registra un movimiento Desde extracto y verifica que conserve el saldo reportado y su tasa EA al recargar.
4. Revisa las proyecciones de 3, 6 y 12 meses y el desglose de capital, intereses y cargos.
5. Prueba las ayudas de los campos, el modo oscuro y el diseño en una pantalla estrecha.
6. Abre el editor de una compra: el fondo debe quedar sin scroll y el modal debe poder desplazarse. Al cerrarlo, el scroll del fondo debe recuperarse.
7. Exporta a PDF y CSV y comprueba que los archivos incluyan los valores del escenario.

Los datos de invitado se guardan en `localStorage` por origen del navegador. Desarrollo y vista previa pueden tener datos separados porque usan puertos distintos; `localhost` y `127.0.0.1` también son orígenes diferentes. No se necesita backend ni conexión a una entidad bancaria para estas comprobaciones del modo invitado. Las comprobaciones de cuentas y sincronización sí requieren la configuración opcional de Supabase y Google.
