# Especificación formal de requisitos
## Plataforma web y administrativa OLDES Rent a Car El Salvador

**Versión:** 1.1  
**Fecha:** 12 de agosto de 2026  
**Estado:** Consolidación integral actualizada con feedback del cliente tras revisión de la versión 1.0  
**Organización:** Operador Logístico de El Salvador, S.A. de C.V. — OLDES Rent a Autos

---

## 1. Propósito del documento

Este documento consolida de forma ordenada y formal todas las necesidades comunicadas por el cliente para la landing page y el sistema administrativo de OLDES Rent a Car.

Incluye:

- mensajes escritos y correcciones de flujo;
- notas de voz y videos demostrativos;
- fotografías de contratos e inspección física;
- feedback del 12 de agosto de 2026 sobre la especificación 1.0;
- referencia de landing de un colega (JC Car Rentals);
- presupuesto PDF actual (`Presupuesto_1009.pdf`);
- calendario actual usado como guía visual;
- video del flujo actual de cotización móvil;
- referencia de usabilidad y campos de la plataforma HQ Rentals (prueba gratuita).

Los videos y plataformas de terceros se consideran **referencias de flujo, facilidad de uso y organización de campos**. **No se solicita copiar exactamente esas herramientas ni su diseño.**

Cuando una indicación posterior corrige una anterior, prevalece la más reciente.

---

## 2. Confirmación del cliente sobre la versión 1.0

El cliente confirmó el 12 de agosto de 2026:

> “Todo lo demás descrito lo veo muy bien según solicitado.”

Por tanto, se mantienen las reglas, módulos y criterios de la versión 1.0, con las ampliaciones y precisiones de esta versión 1.1.

Además, el cliente reiteró que la plataforma debe ser **demasiado fácil de usar** y cubrir **todo lo solicitado**.

---

## 3. Reglas definitivas del negocio

### RN-01. Solicitud desde la landing

El formulario público debe crear una solicitud de cotización y facilitar el contacto por WhatsApp para brindar atención personalizada.

### RN-02. Cotización independiente de la reserva

Las cotizaciones deben estar relacionadas con el cliente, pero no tienen que estar ligadas obligatoriamente a una reserva.

### RN-03. Aceptación sin automatización

La aceptación de una cotización no debe:

- reservar automáticamente el vehículo;
- bloquear automáticamente el vehículo;
- crear automáticamente una reserva;
- abrir automáticamente un contrato;
- generar automáticamente un número de contrato.

### RN-04. Reserva manual

Después de que el cliente acepte la cotización, el operador creará personalmente la reserva en el calendario e ingresará la información y los costos acordados.

### RN-05. Contrato al entregar

El contrato se generará únicamente cuando se entregue el vehículo. En ese momento se asignará el correlativo. Esto evita mantener contratos abiertos cuando una persona reserva con varios meses de anticipación.

### RN-06. Operación sin sucursal física

Por el momento OLDES no cuenta con ubicación física para atención al público. La landing page no debe mostrar un campo o dirección de sucursal. El servicio funciona mediante entregas a domicilio y entregas o devoluciones en ubicaciones acordadas.

### RN-07. Cobro por períodos de 24 horas

La renta se calcula por períodos de 24 horas. El sistema podrá calcular los días automáticamente a partir de fecha y hora de salida y devolución, manteniendo la posibilidad de ajuste manual autorizado.

### RN-08. Pago con tarjeta

La landing debe informar que se acepta efectivo y tarjeta. Las tarjetas tienen un cargo de transacción del 10 %, por lo que se recomienda el efectivo. En las reservas deben poder registrarse por separado el monto en efectivo y el monto con tarjeta.

### RN-09. Kilometraje acumulado

El kilometraje registrado durante la salida y la devolución debe actualizar el kilometraje actual del vehículo y quedar en su historial.

### RN-10. Facilidad operativa (nuevo)

Una vez que el cliente ya exista en el sistema, el operador debe poder elaborar y enviar una cotización en **máximo 3 minutos**.

### RN-11. Abonos compartibles (nuevo)

Los abonos deben poder compartirse con el cliente de la misma forma que los contratos, como **recibos electrónicos** (PDF y/o enlace compartible por WhatsApp o correo).

---

## 4. Landing page pública

### 4.1. Identidad y contacto

- Marca visible: **OLDES Rent a Car El Salvador**.
- Teléfono y WhatsApp: **+503 7435-0381**.
- No mostrar ubicación física ni campo de sucursal.
- El correo corporativo queda pendiente de decidir entre:
  - correo asociado al dominio; o
  - una cuenta de Gmail.

### 4.2. Sección “Why choose OLDES Rent a Car El Salvador?”

La landing debe presentar estos beneficios:

1. **Easy Online Booking**  
   Reserve your vehicle quickly and easily online, anytime.
2. **Free Airport Pickup & Drop-off**  
   Available 24/7 at any airport in El Salvador.
3. **No Deposit Required**  
   Enjoy your trip with zero deposit required.
4. **Insurance Included**  
   Insurance coverage included with every rental.
5. **24/7 Roadside Assistance**  
   We're here for you anytime, anywhere.
6. **Cash & Credit Cards Accepted**  
   Credit cards have a 10% transaction fee. Cash recommended.

### 4.3. Solicitud de cotización

El visitante debe poder indicar los datos necesarios para solicitar una cotización. La solicitud debe:

- llegar o derivarse a WhatsApp para atención personalizada;
- quedar registrada en el sistema como solicitud pendiente;
- no convertirse en una reserva;
- no bloquear disponibilidad;
- permitir que el operador posteriormente cree una cotización formal.

### 4.4. Flota pública — solo tipo de vehículo y costos (actualizado)

En la sección pública de vehículos **solo deben mostrarse el tipo de vehículo que se puede alquilar y sus costos**, no un listado administrativo de unidades individuales.

Referencia de presentación: [JC Car Rentals](https://www.jccarrentalses.com/), sección **Our Vehicle Options & Daily Rates**.

Cada tarjeta pública debe incluir, como mínimo:

- tipo de vehículo (por ejemplo: Sedan, 2 Row SUV, 3 Row SUV, Pickup, Minivan, u otras categorías definidas por OLDES);
- tarifa diaria;
- atributos comerciales simples (asientos, maletas, A/C, etc.);
- acción para ver detalle o iniciar solicitud de cotización.

El administrador definirá:

- qué tipos están publicados;
- tarifa diaria por tipo;
- atributos visibles;
- fotografías representativas del tipo.

La flota real (placas, VIN, unidad específica) permanece en el sistema administrativo y se asigna al crear la reserva o el contrato.

---

## 5. Clientes

### 5.1. Perfil centralizado

Cada cliente debe tener un perfil único desde el cual se consulten:

- datos personales o empresariales;
- documentos e imágenes;
- cotizaciones;
- reservas;
- rentas y contratos;
- abonos y recibos;
- historial relacionado.

### 5.2. Persona natural

Datos solicitados:

- nombre completo;
- número de DUI o pasaporte;
- número de licencia;
- vencimiento de licencia;
- teléfono;
- país de origen o nacionalidad;
- dirección;
- correo electrónico;
- fotografía o imagen del documento/licencia;
- conductor adicional, cuando corresponda.

### 5.3. Empresa

El sistema debe diferenciar una persona natural de una empresa. Para una empresa se requieren, según corresponda:

- nombre o razón social a facturar;
- NIT;
- número de registro fiscal/NRC;
- persona de contacto;
- teléfono;
- correo electrónico;
- dirección;
- nombre y firma de quien recibe el vehículo;
- nombre y firma de quien entrega o devuelve el vehículo.

### 5.4. Uso de datos en documentos

Al crear cotización, reserva o contrato se debe poder:

- elegir un cliente existente y autocompletar sus datos;
- ingresar un cliente manualmente cuando sea necesario;
- exportar únicamente los datos disponibles;
- incluir la imagen o documento del cliente cuando corresponda;
- evitar bloquear el documento solamente porque un dato opcional no exista.

---

## 6. Cotizaciones (actualizado con flujo actual del cliente)

### 6.1. Objetivo de usabilidad

La cotización debe ser el módulo más ágil del sistema. Meta operativa del cliente:

> Una vez los datos del cliente estén ingresados, elaborar la cotización en **3 minutos máximo**.

### 6.2. Creación rápida

El operador debe crear cotizaciones mediante un formulario amigable. Las cotizaciones:

- pertenecen a un cliente;
- no dependen de una reserva;
- pueden existir antes de conocer o confirmar una reserva;
- deben poder elaborarse en español o inglés;
- se utilizarán mayoritariamente en inglés;
- deben permitir seleccionar artículos/servicios de un catálogo predefinido;
- deben permitir agregar líneas personalizadas;
- deben calcular impuestos, descuentos y totales automáticamente.

### 6.3. Campos observados en el presupuesto actual (`Presupuesto_1009`)

La cotización PDF/formato debe contemplar, como mínimo:

- número de presupuesto / correlativo de cotización;
- fecha de emisión;
- vigencia o “válido hasta”, cuando aplique;
- cliente;
- período cotizado (fecha/hora inicio y fin);
- líneas de detalle:
  - tipo de vehículo / servicio;
  - descripción (transmisión, A/C, capacidad, etc.);
  - cantidad;
  - precio;
  - importe;
- cargos adicionales (ejemplo: “Entrega y/o fuera de horas laborales”);
- descuento (%), cuando aplique;
- subtotal / total neto;
- impuesto (ejemplo actual: TAX 13 %);
- total en USD;
- texto de bienvenida / presentación;
- condiciones de pago;
- instrucciones de entrega y devolución;
- póliza de seguro y deducibles por tipo de vehículo;
- directrices de conducción;
- datos de contacto OLDES.

### 6.4. Catálogo de artículos y servicios

Para lograr velocidad, el sistema debe mantener un catálogo configurable de:

- tipos de vehículo con tarifas;
- servicios adicionales (entrega, fuera de horario, etc.);
- impuestos disponibles (por ejemplo 0 %, 13 % y otros que se definan);
- textos reutilizables de condiciones.

El operador debe poder:

1. elegir cliente;
2. elegir período;
3. agregar artículos desde catálogo;
4. ajustar cantidad/precio/impuesto;
5. previsualizar;
6. enviar.

### 6.5. Entrega al cliente

La cotización terminada debe poder:

- generar un formato profesional;
- exportarse a PDF;
- previsualizarse antes de enviar;
- compartirse por WhatsApp;
- enviarse por correo cuando se defina y configure el correo corporativo.

### 6.6. Aceptación

El sistema puede registrar que una cotización fue aceptada, pero esa acción no debe crear automáticamente otros registros operativos. El operador decidirá cuándo crear la reserva manual.

### 6.7. Referencias de usabilidad

- Video del flujo móvil actual de elaboración de presupuesto (12 de agosto de 2026): creación de cliente, catálogo de artículos/servicios, detalle del presupuesto, impuestos rápidos, términos y previsualización/envío.
- Plataforma HQ Rentals (prueba gratuita del cliente): referencia de campos y gestión. Se tomará como inspiración de facilidad y organización, **sin replicar la herramienta**.

---

## 7. Reservas y calendario (actualizado)

### 7.1. Creación manual

La reserva será creada personalmente por el operador después de confirmar la aceptación y los detalles con el cliente.

### 7.2. Datos de la reserva

- cliente;
- vehículo (unidad específica);
- tipo de vehículo;
- fecha y hora de entrega;
- lugar de entrega;
- fecha y hora de devolución;
- lugar de devolución;
- monto acordado en efectivo;
- monto correspondiente al pago con tarjeta;
- costos o información adicional;
- estado de la reserva;
- notas.

El teléfono no necesita repetirse si ya se obtiene del perfil del cliente.

### 7.3. Calendario — guía visual del cliente

El calendario debe inspirarse en el estilo de uso actual del cliente (vista mensual tipo Google Calendar), sin copiar marcas de terceros.

Debe permitir:

- vista mensual clara;
- botón “Hoy”;
- navegación entre meses;
- selector de vista (mes y, si aporta, semana/día/lista);
- búsqueda;
- actualización / refresco;
- barras horizontales que abarcan varios días;
- etiqueta por evento con, al menos:
  - hora (cuando aplique);
  - vehículo o tipo/modelo;
  - nombre del cliente;
- colores diferenciados por estado, vehículo o tipo de evento;
- manejo de sobrecarga del día con “+ X más”;
- eventos no rentales útiles (feriados, mantenimiento, citas), cuando se carguen.

El calendario es la herramienta principal para ver disponibilidad y duración de rentas de un vistazo.

---

## 8. Vehículos y control de flota

### 8.1. Datos maestros

- marca;
- modelo;
- año;
- tipo o categoría de vehículo;
- placas;
- color;
- capacidad;
- chasis;
- VIN;
- número de motor;
- tipo de combustible;
- aceite de motor;
- kilometraje actual;
- información de llantas;
- fotografías;
- estado operativo;
- visibilidad comercial del tipo en la landing;
- tarifa asociada al tipo, cuando corresponda.

### 8.2. Perfil del vehículo

Cada vehículo debe concentrar:

- datos técnicos;
- fotografías;
- reservas;
- contratos;
- inspecciones;
- kilometraje histórico;
- mantenimientos;
- gastos;
- repuestos;
- cartas u órdenes de taller;
- ingresos producidos;
- balance de rentabilidad.

### 8.3. Interés confirmado del cliente

El cliente confirmó interés explícito en el **control y gestión de los vehículos** como capacidad de la plataforma.

---

## 9. Inspección del vehículo

### 9.1. Prioridad

La inspección es un componente crítico. Las fotografías deben conservar suficiente detalle para comprobar rayones, golpes y piezas faltantes, sin hacer que la plataforma almacene archivos innecesariamente pesados.

### 9.2. Optimización de imágenes

El sistema debe:

- conservar una versión de alta calidad como evidencia;
- corregir orientación;
- comprimir de forma controlada sin borrar rayones pequeños;
- generar versiones optimizadas para pantalla y miniaturas;
- evitar cargar la fotografía original en cada vista;
- guardar metadatos de fecha, inspección, vehículo y fase;
- mantener privadas las evidencias del contrato;
- permitir ampliar la imagen para revisar detalles.

### 9.3. Diagrama de daños

La inspección debe mostrar un vehículo reconocible y comprensible para el cliente. Puede utilizar 2D o una visualización 3D si mejora la operación, pero no se requiere un modelo exclusivo por cada vehículo.

Se aceptan plantillas genéricas por carrocería:

- sedán de cuatro puertas y baúl;
- pickup de cuatro puertas y palangana;
- microbús o vehículo alto, cuando corresponda.

El diagrama debe permitir marcar:

- golpe;
- rayón;
- pieza faltante;
- ubicación exacta;
- descripción;
- severidad;
- fotografías asociadas.

La referencia física utiliza:

- **0 = GOLPE**
- **+ = RAYÓN**
- **x = FALTANTE**

### 9.4. Vistas

El documento de inspección puede utilizar las vistas:

- lateral izquierdo;
- lateral derecho;
- superior;
- frontal;
- trasera.

La representación debe ser clara; no debe consistir en rectángulos abstractos que el cliente no identifique como un vehículo.

### 9.5. Salida y entrada

La inspección debe registrar por separado:

- estado de salida;
- estado de entrada;
- daños preexistentes;
- daños nuevos;
- fotografías de ambas fases;
- combustible de salida y entrada;
- kilometraje de salida y entrada;
- persona que entrega;
- persona que recibe;
- firmas correspondientes.

### 9.6. Combustible y kilometraje

Al entregar y recibir el vehículo se debe:

- tomar fotografía del marcador/tablero o indicador de combustible;
- registrar manualmente el kilometraje;
- registrar el nivel de combustible;
- conservar evidencia de ambas fases;
- actualizar el kilometraje maestro del vehículo al finalizar.

---

## 10. Revisión de accesorios

La revisión debe ser visual, rápida y seleccionable mediante iconos o controles tipo check. Debe guardar qué accesorio se entregó y qué accesorio regresó.

Lista solicitada y observada en los formatos:

- llanta de repuesto;
- mica;
- palanca de mica;
- llave de cruz;
- cono o triángulo;
- extintor;
- cables para corriente;
- limpiaparabrisas;
- cubiertas y demás accesorios configurables.

El catálogo debe ser configurable para agregar o retirar accesorios sin modificar el contrato manualmente.

---

## 11. Contratos

### 11.1. Momento de creación

El contrato se crea únicamente al entregar el vehículo. En ese momento se asigna un correlativo consecutivo.

### 11.2. Experiencia de creación

El flujo debe ser amigable, por pasos, y funcionar en tablet. Debe admitir:

- seleccionar datos existentes;
- ingresar datos manualmente;
- avanzar y regresar sin perder información;
- revisar todo antes de firmar;
- generar un PDF de varias páginas cuando sea necesario.

No es obligatorio comprimir todo en una sola página como el formulario físico.

### 11.3. Componente 1 — Arrendatario

- arrendatario;
- DUI o pasaporte;
- licencia;
- vencimiento;
- teléfono;
- dirección;
- correo electrónico;
- tipo de cliente;
- conductor adicional;
- datos empresariales cuando corresponda.

### 11.4. Componente 2 — Vehículo

- marca;
- modelo;
- placas;
- tipo;
- combustible;
- salida;
- entrada;
- inspección de daños;
- accesorios;
- combustible;
- kilometraje;
- fotografías.

### 11.5. Componente 3 — Facturación

- fecha y hora de inicio;
- fecha y hora final;
- período facturado;
- cantidad de días de 24 horas;
- tarifa;
- subtotal;
- cargos adicionales;
- combustible;
- daños o golpes cobrados;
- observaciones;
- documentos anexos;
- abonos;
- saldo pendiente;
- total.

### 11.6. Abonos, saldo y recibos electrónicos (actualizado)

El contrato debe aceptar:

- abono inicial;
- abonos durante la renta;
- abono al finalizar;
- monto complementario final;
- saldo calculado;
- estado pagado o pendiente;
- historial con fecha, monto, método y usuario que registró el pago.

**Nuevo requisito confirmado por el cliente:**

Los abonos deben poder compartirse con los clientes **como los contratos**, en forma de **recibos electrónicos**.

Cada recibo debe poder:

- generarse en PDF;
- previsualizarse;
- compartirse por WhatsApp;
- enviarse por correo;
- quedar ligado al cliente y al contrato;
- conservar número, fecha, monto, concepto, método de pago y saldo restante.

La estructura visual definitiva del recibo será aportada por el cliente en breve.

### 11.7. Observaciones y anexos

Debe existir un espacio amplio para observaciones como:

- condiciones especiales;
- solicitudes del cliente;
- comportamiento de devolución;
- cargos;
- daños;
- acuerdos;
- referencias a facturas, créditos fiscales u otros documentos anexos.

### 11.8. Términos y firma inicial

Antes de completar la entrega:

- se mostrarán los términos y condiciones;
- el usuario podrá desplazarse por el texto completo;
- el arrendatario aceptará los términos;
- se capturará firma digital;
- se registrarán fecha, hora e identidad del firmante.

Los términos legales definitivos deberán ser proporcionados o aprobados por OLDES.

### 11.9. PDF

El PDF debe contener toda la información de los componentes, firmas, inspección, accesorios y términos. Puede ocupar varias páginas para mantener legibilidad.

---

## 12. Cierre de renta y devolución

Al cerrar el contrato, el sistema debe solicitar:

1. inspección de entrada;
2. fotografía de combustible o tablero;
3. kilometraje final ingresado manualmente;
4. nivel de combustible;
5. estado de accesorios;
6. daños nuevos;
7. cargos adicionales;
8. actualización del cuadro de facturación;
9. cálculo del saldo faltante;
10. monto complementario pagado o pendiente;
11. firma digital de renta finalizada;
12. nombre de quien entrega y quien recibe, especialmente para empresas.

Después del cierre:

- el contrato queda finalizado;
- el vehículo cambia al estado correspondiente;
- el kilometraje se actualiza;
- los pagos quedan conciliados;
- el PDF final incluye la información de devolución;
- el historial conserva salida y entrada;
- los recibos de abono quedan disponibles en el expediente.

---

## 13. Mantenimiento, taller y gastos

El sistema debe permitir llevar por vehículo:

- ingreso generado;
- gastos;
- reparaciones;
- repuestos comprados;
- trabajo realizado;
- fecha;
- proveedor o taller;
- kilometraje;
- observaciones;
- comprobantes;
- carta u orden de taller;
- historial completo.

El objetivo es reemplazar o complementar la hoja de Excel utilizada actualmente y calcular cuánto genera cada vehículo frente a cuánto se gasta en él.

---

## 14. Pantalla de inicio

La pantalla inicial del sistema debe funcionar como resumen operativo. Debe mostrar:

- pendientes del día;
- reservas de hoy;
- reservas de mañana;
- vehículos que deben entregarse;
- vehículos que deben recibirse;
- agenda similar a un resumen de calendario;
- contratos abiertos;
- acceso directo para abrir o cerrar un contrato;
- alertas de contratos que pudieron quedar abiertos por error.

La intención es evitar entrar diariamente al calendario solo para descubrir las actividades inmediatas.

---

## 15. Capacidades adicionales que la plataforma puede ofrecer

El cliente preguntó qué más aspectos podrían incluirse con base en lo ya manejado o mostrado. Además de lo solicitado, la plataforma puede incorporar, sin desviarse del alcance central:

1. **Control y gestión de flota** (interés confirmado): estados, disponibilidad, historial por unidad, fotos y rentabilidad.
2. **Dashboard operativo** del día: entregas, devoluciones, contratos abiertos y pendientes.
3. **Alertas** de vencimientos, mantenimiento, contratos abiertos y saldos pendientes.
4. **Gestión de documentos del cliente**: licencia, pasaporte/DUI y foto asociada al expediente.
5. **Catálogo de tarifas y servicios** para cotizar en minutos.
6. **Recibos electrónicos de abonos** compartibles.
7. **Inspección digital con evidencia fotográfica** y marcas de daño.
8. **Historial financiero por vehículo**: ingresos vs. gastos/taller.
9. **Roles y permisos**: separar operación diaria de información financiera sensible.
10. **Exportación y reenvío** de cotizaciones, contratos y recibos.

Estas capacidades se alinean con lo solicitado y con lo que el cliente indicó haber visto con interés.

---

## 16. Roles, acceso y privacidad

El sistema debe contemplar:

- acceso seguro;
- rol administrador;
- rol empleado;
- permisos por función;
- protección de estadísticas financieras;
- posibilidad de que solo el administrador vea ingresos, gastos, utilidad y rendimiento;
- registro de acciones importantes.

No se requiere copiar mecanismos de PIN de demos de terceros; debe usarse autenticación segura.

---

## 17. Reportes y estadísticas

Cuando existan datos suficientes, el administrador debe poder consultar:

- ingresos;
- gastos;
- utilidad;
- rendimiento por vehículo;
- vehículo más rentado;
- clientes frecuentes;
- cantidad de vehículos disponibles, reservados, alquilados y en mantenimiento;
- saldos pendientes;
- contratos abiertos;
- historial de gastos y reparaciones;
- cotizaciones emitidas y aceptadas.

---

## 18. Requisitos no funcionales

### RNF-01. Uso en tablet y móvil

Los flujos de cotización, entrega, inspección, firma y devolución deben funcionar correctamente en tablet y ser utilizables frente al cliente.

### RNF-02. Facilidad de uso

Los formularios de cotización y contrato deben dividirse en pasos claros, usar catálogos y autocompletar datos para evitar escritura repetitiva. Meta: cotización en ≤ 3 minutos con cliente existente.

### RNF-03. Calidad de evidencia

La optimización de fotografías no debe impedir visualizar rayones, golpes u otros detalles relevantes.

### RNF-04. Rendimiento

La plataforma no debe cargar imágenes originales pesadas en listados; utilizará miniaturas y versiones adaptadas.

### RNF-05. Seguridad y privacidad

Documentos de identidad, contratos, firmas, recibos y fotografías de inspección deben mantenerse privados y accesibles solo para personal autorizado.

### RNF-06. Trazabilidad

Cambios de estado, correlativos, pagos, firmas, inspecciones y cierres deben registrar fecha, hora y usuario responsable.

### RNF-07. Integridad

Los datos históricos de un contrato cerrado no deben cambiar silenciosamente. Las correcciones deben quedar auditadas.

### RNF-08. Disponibilidad documental

Cotizaciones, contratos y recibos de abono deben poder consultarse y descargarse nuevamente en PDF.

---

## 19. Flujo operativo definitivo

1. El visitante consulta la landing, ve tipos de vehículo y tarifas diarias.
2. Envía una solicitud de cotización.
3. La solicitud llega al sistema y facilita el contacto por WhatsApp.
4. El operador atiende personalmente al cliente.
5. Si el cliente no existe, se crea su perfil.
6. El operador crea una cotización en español o inglés en pocos minutos.
7. La cotización se previsualiza y se comparte por WhatsApp o correo.
8. El cliente acepta o rechaza.
9. Si acepta, el operador crea manualmente una reserva en el calendario.
10. La reserva guarda fechas, horas, ubicaciones, vehículo y costos.
11. El contrato todavía no existe.
12. Al momento de entregar el vehículo, el operador inicia “Generar contrato / Entregar vehículo”.
13. Selecciona o ingresa cliente y vehículo.
14. Realiza inspección de salida, accesorios, combustible, fotos y kilometraje.
15. Completa facturación y registra abono inicial si existe.
16. Emite recibo electrónico del abono cuando corresponda.
17. El cliente acepta términos y firma digitalmente.
18. El sistema asigna correlativo y genera el contrato PDF.
19. Durante la renta se pueden registrar abonos, emitir recibos y agregar observaciones.
20. En la devolución se realiza inspección de entrada, fotos, combustible y kilometraje.
21. Se calculan cargos, saldo y monto complementario.
22. Se captura la firma de renta finalizada.
23. Se cierra el contrato y se actualiza el estado y kilometraje del vehículo.

---

## 20. Exclusiones y aclaraciones expresas

- No copiar exactamente JC Car Rentals, HQ Rentals ni la app móvil de presupuestos.
- No convertir automáticamente una cotización aceptada en reserva.
- No crear automáticamente un contrato al aceptar una cotización.
- No crear el correlativo con meses de anticipación.
- No mostrar una sucursal física inexistente.
- No publicar en la landing el inventario interno de cada placa; solo tipos y costos.
- No exigir un modelo 3D exclusivo para cada marca y modelo.
- No sacrificar legibilidad para forzar el contrato a una sola página.
- No comprimir fotografías al punto de ocultar rayones.

---

## 21. Decisiones pendientes de OLDES

1. Correo definitivo: dominio corporativo o Gmail.
2. Texto legal final de términos y condiciones.
3. Confirmación de campos fiscales exactos para empresas: NIT, NRC y otros.
4. Confirmación del catálogo final de accesorios y el significado exacto de “mica / palanca de mica”.
5. Política final para documentos anexos y su tiempo de conservación.
6. Reglas de autorización para ajustes manuales de días, tarifas y saldos.
7. Estructura visual definitiva del recibo electrónico de abonos (el cliente la compartirá en breve).
8. Catálogo final de tipos de vehículo y tarifas diarias públicas.
9. Confirmación de impuestos a manejar en cotizaciones (ejemplo actual 13 %).
10. Textos estándar de entrega/devolución/aeropuerto a reutilizar en cotizaciones.

---

## 22. Criterios generales de aceptación

El producto se considerará alineado con el requerimiento cuando:

- la landing no muestre ubicación física;
- el teléfono correcto sea visible;
- la sección de vehículos muestre tipos y costos, no el inventario interno;
- la solicitud pública genere una solicitud de cotización, no una reserva;
- las cotizaciones estén asociadas al cliente, sean bilingües y se elaboren en ≤ 3 minutos con cliente existente;
- aceptar una cotización no genere reserva ni contrato;
- el operador pueda crear reservas manualmente;
- el calendario permita ver rentas por duración con vehículo y cliente;
- el contrato se genere solo al entregar el vehículo;
- clientes y vehículos autocompleten el contrato;
- se pueda trabajar con persona natural o empresa;
- la inspección permita evidencias claras y fotos optimizadas;
- se registren salida y entrada con combustible, kilometraje y daños;
- los accesorios sean configurables y comparables;
- existan abonos, saldo y monto complementario;
- los abonos puedan compartirse como recibos electrónicos;
- haya firma inicial y firma de finalización;
- el kilometraje actualice el vehículo;
- el dashboard muestre agenda inmediata y contratos abiertos;
- el historial por vehículo incluya taller, gastos e ingresos;
- los documentos puedan exportarse en PDF de forma legible;
- la plataforma se perciba simple y rápida en la operación diaria.

---

## 23. Fuentes consolidadas

### Versión 1.0

- Mensaje integral de requisitos del 8 de agosto de 2026.
- Ocho audios de WhatsApp del 4 y 8 de agosto de 2026.
- Dos videos de WhatsApp del 4 de agosto de 2026, considerados demostrativos.
- Fotografías del contrato físico OLDES.
- Fotografías de los diagramas de inspección vehicular.
- Correcciones expresas sobre cotización, reserva, contrato, correlativo y ausencia de ubicación física.

### Versión 1.1 — 12 de agosto de 2026

- Confirmación escrita: “todo lo demás descrito lo veo muy bien según solicitado”.
- Instrucción de landing: mostrar solo tipo de vehículo y costos.
- Referencia pública: https://www.jccarrentalses.com/
- Requisito 15.6 / abonos: compartir como recibos electrónicos; estructura de recibo pendiente.
- Interés confirmado en control y gestión de vehículos.
- Captura del calendario actual (Agosto 2026) como guía de encabezado y visualización.
- PDF de cotización actual: `Presupuesto_1009.pdf`.
- Video del flujo de cotización móvil: `WhatsApp Video 2026-08-12 at 8.33.25 AM.mp4`.
- Referencia de usabilidad HQ Rentals (prueba gratuita del cliente).
- Énfasis reiterado: plataforma demasiado fácil de usar y completa respecto a lo solicitado.

---

**Fin de la especificación**
