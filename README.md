# Mi corte: calculador de tarjeta

Aplicación financiera personal en español, hecha con React y Vite, para estimar pagos de tarjetas de crédito en pesos colombianos. No necesita backend.

## Funcionalidades

- Varias tarjetas con tasas, fechas de corte y condiciones independientes, guardadas en el navegador.
- Tasa mensual vencida (MV) o efectiva anual (EA), convertida a mensual automáticamente.
- Compras a una cuota o diferidas, con fecha, valor original y cuotas pagadas y pendientes.
- Registro Desde extracto con saldo reportado, cuotas pendientes, tasa particular EA, fecha de proceso y primer corte explícito; adecuado para refinanciaciones y abonos que alteran el saldo.
- Un único formulario de compra nueva y una lista separada con edición y eliminación.
- Saldo anterior separado del capital de las compras registradas, sin sumarlo completo al mínimo.
- Desglose de capital, intereses, cargos y abonos; pago mínimo y pago total al corte.
- Cupo total y cupo actual disponible informados por el banco, editables y guardados por tarjeta.
- Pago total pendiente estimad: diferencia entre el cupo total y el cupo actual disponible.
- Campos monetarios con puntos de miles y coma decimal durante la escritura, por ejemplo `1.234.567,89`.
- Proyecciones de 3, 6 y 12 meses, con gráfico y tabla.
- Modo claro y oscuro, diseño adaptable y confirmación antes de eliminar.
- Exportación PDF y CSV de la tarjeta, sus compras y la proyección seleccionada.

## Reglas del cálculo

**Saldo anterior** es el capital que no está desglosado en las compras registradas. Si registras una compra anterior con cuotas pendientes, excluye ese capital del saldo anterior para no contarlo dos veces. No ingreses intereses acumulados como capital: usa los cargos adicionales para importes ya facturados.

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

En este modo no se reconstruye el saldo como valor original dividido entre plazo. El capital pendiente es el **saldo informado**, conservando ajustes, abonos y refinanciaciones. Si se deja vacía la cuota de capital, la estimación divide ese saldo entre las cuotas pendientes. Solo copia Valor Cuota Mes en la cuota de capital si el banco confirma que no incluye intereses. Se calculan intereses mensuales sobre el saldo restante y la última cuota ajusta cualquier diferencia de redondeo. No se infieren cuotas pagadas desde el plazo: cuotas facturadas y cuotas pagadas no son lo mismo.

**Primer corte a proyectar** indica cuándo empieza a pagarse el saldo que copiaste. Si el saldo pendiente excluye la cuota ya facturada, selecciona el siguiente corte para proyectar ese saldo. Esto no supone que hayas pagado la cuota actual: si sigue exigible, hay que contabilizarla por separado o usar un saldo actualizado del banco. Este modo no reconstruye el pago mínimo exacto del extracto ya emitido.

No agregues el saldo de los movimientos registrados también a Saldo anterior: registra allí solo deuda no desglosada. Las filas con saldo y cuotas pendientes cero no aportan saldo futuro, pero su cuota actual puede estar facturada y todavía sin pagar. Los pagos no son compras; no los vuelvas a descontar si ya están reflejados en los saldos.

## Almacenamiento y migración

Los datos usan `localStorage` con la clave `tarjeta-cuota-calculador-v2`. La tasa se configura una vez por tarjeta; nuevas compras la heredan. El tema y horizonte también se conservan. No se guardan números de tarjeta ni se envían datos financieros a un servidor; las fuentes tipográficas se cargan desde Google Fonts.

PDF y CSV contienen los datos del escenario, las compras y los meses elegidos. CSV usa UTF-8 con BOM, separador `;`, valores numéricos sin formato monetario y protección contra fórmulas en nombres y descripciones.

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
   features/
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

```bash
npm install
npm run dev
```

Luego abre la URL que indique Vite.

## Crear build

```bash
npm run build
npm run preview
```

## Pruebas

```bash
npm test
```

Las pruebas ejecutan el motor financiero y la persistencia con `node:test`: separación de saldos, cuotas pagadas, abonos, tasas EA/MV, compras posteriores al corte, meses cortos, cargos y migración.

## GitHub Pages

1. Crea un repositorio llamado `tarjeta-cuota-calculador` (o el nombre que prefieras).
2. Sube el proyecto a la rama `main`.
3. En GitHub ve a **Settings → Pages**.
4. En **Build and deployment → Source**, selecciona **GitHub Actions**.
5. El workflow de `.github/workflows/deploy.yml` hará el build y despliegue.
6. Si cambiaste el nombre del repositorio, cambia `VITE_BASE` en el workflow para que coincida:
   `/NOMBRE-DEL-REPOSITORIO/`

La aplicación usa `localStorage` para conservar los datos introducidos en ese navegador y no necesita backend.
