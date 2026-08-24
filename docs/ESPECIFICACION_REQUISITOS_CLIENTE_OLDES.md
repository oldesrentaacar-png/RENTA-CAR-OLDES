# Especificación formal de requisitos del cliente

## Plataforma OLDES Rent a Car

**Versión del documento:** 1.0  
**Fecha de consolidación:** 8 de agosto de 2026  
**Estado:** requisitos consolidados para validación  
**Propósito:** documentar de forma ordenada y fiel las necesidades expresadas por el cliente en mensajes, audios, videos e imágenes de referencia.

---

## 1. Criterio de interpretación

Este documento diferencia entre:

1. **Requisitos expresos del cliente:** funciones, datos y reglas solicitadas directamente.
2. **Referencias visuales o funcionales:** ejemplos enviados para explicar una idea, sin obligación de copiarlos exactamente.
3. **Correcciones posteriores:** indicaciones recientes que sustituyen interpretaciones anteriores.
4. **Pendientes de confirmación:** información que el cliente aún debe definir.

Los videos enviados muestran herramientas de referencia. **No deben copiarse literalmente ni asumirse todas sus funciones como requisitos obligatorios.** Deben utilizarse únicamente para comprender el tipo de experiencia, organización y flujo que el cliente espera.

---

## 2. Objetivo general del sistema

OLDES Rent a Car necesita una plataforma compuesta por:

- Una **Landing Page pública** para mostrar la empresa, vehículos y solicitar cotizaciones.
- Un **sistema administrativo privado** para gestionar clientes, vehículos, cotizaciones, reservas, contratos, inspecciones, pagos, mantenimiento y seguimiento operativo.
- Una experiencia ágil desde computadora o tableta.
- Documentos digitales que puedan generarse en PDF y compartirse por WhatsApp o correo electrónico.

El sistema debe facilitar el trabajo diario sin obligar al cliente a replicar exactamente sus formularios físicos actuales. Los documentos físicos enviados sirven principalmente para identificar el orden, los campos y la lógica de trabajo.

---

## 3. Datos institucionales y contacto

### 3.1 Información confirmada

- Nombre comercial: **OLDES Rent a Car El Salvador**.
- Teléfono y WhatsApp: **+503 7435-0381**.
- La empresa **no cuenta por el momento con una ubicación física para atención al público**.
- El servicio funciona mediante **entrega y devolución a domicilio o en el lugar acordado**.

### 3.2 Regla para la Landing Page

- No mostrar un campo, bloque o dirección de sucursal física.
- No comunicar que el cliente debe presentarse en una oficina.
- La comunicación debe destacar el servicio de entrega coordinada y la atención por WhatsApp.

### 3.3 Correo electrónico

El correo corporativo todavía está pendiente de decisión. El cliente desea evaluar:

- Si el proveedor del dominio incluye correo corporativo.
- Si utilizará una cuenta con el dominio de OLDES.
- Si continuará temporalmente con una cuenta de Gmail.

El sistema debe permitir cambiar posteriormente el correo de contacto sin modificar código.

---

## 4. Idioma

- La Landing Page debe poder presentarse en **español e inglés**.
- El cliente indica que gran parte de su operación o comunicación se realiza en inglés.
- Las cotizaciones deben poder generarse en **español o inglés**.
- El idioma debe seleccionarse antes de generar el documento.
- Los textos, importes, fechas y etiquetas del PDF deben corresponder al idioma seleccionado.

La definición del idioma predeterminado de la Landing Page queda pendiente de confirmación; el inglés será de uso frecuente.

---

## 5. Contenido público: “Why choose OLDES Rent a Car El Salvador?”

La Landing Page debe incluir los siguientes beneficios, respetando su sentido comercial:

### Easy Online Booking

Reserve your vehicle quickly and easily online, anytime.

### Free Airport Pickup & Drop-off

Available 24/7 at any airport in El Salvador.

### No Deposit Required

Enjoy your trip with zero deposit required.

### Insurance Included

Insurance coverage included with every rental.

### 24/7 Roadside Assistance

We're here for you anytime, anywhere.

### Cash & Credit Cards Accepted

Credit cards have a 10% transaction fee. Cash recommended.

Estos textos deben contar con su equivalente en español dentro de la versión traducida de la Landing Page.

---

## 6. Flujo comercial definitivo

Este flujo constituye una corrección expresa del cliente y debe prevalecer sobre cualquier interpretación anterior.

### 6.1 Solicitud desde la Landing Page

1. El visitante consulta la información y los vehículos.
2. Envía una **solicitud de cotización**.
3. La solicitud se dirige o notifica por **WhatsApp**, para permitir atención personalizada.
4. La solicitud es solamente una oportunidad o solicitud pendiente.

### 6.2 Creación de la cotización

1. El personal de OLDES atiende personalmente al interesado.
2. El personal crea la cotización dentro del sistema administrativo.
3. La cotización se vincula al cliente.
4. La cotización puede compartirse por:
   - WhatsApp.
   - Correo electrónico.
   - PDF descargable.

### 6.3 Relación entre cotización y reserva

- Las cotizaciones **no necesitan estar ligadas a una reserva**.
- Sí deben estar ligadas al cliente.
- La aceptación de una cotización **no crea automáticamente una reserva**.
- La aceptación de una cotización **no abre automáticamente un contrato**.

### 6.4 Creación de la reserva

Cuando el cliente acepte una cotización:

1. El personal de OLDES creará personalmente la reserva en el calendario.
2. Ingresará las fechas, horas, lugares, vehículo, costos y demás información acordada.
3. El sistema bloqueará o marcará la disponibilidad del vehículo según la reserva creada.

### 6.5 Creación del contrato

- El contrato se genera **hasta el momento de entregar el vehículo**.
- No debe abrirse un contrato cuando solamente se acepta una cotización o se crea una reserva.
- Al generar el contrato en la entrega, el sistema debe asignar su **número correlativo**.
- Esta regla evita mantener contratos abiertos durante meses cuando una reserva se realizó con mucha anticipación.

### 6.6 Resumen del flujo

**Solicitud web → atención personalizada por WhatsApp → cotización administrativa → aceptación del cliente → reserva manual en calendario → entrega del vehículo → generación del contrato correlativo.**

---

## 7. Módulo de clientes

### 7.1 Datos mínimos solicitados

Cada cliente debe permitir registrar:

- Nombre completo.
- Número de licencia.
- Fecha de vencimiento de la licencia.
- Número de pasaporte o DUI.
- Teléfono.
- Correo electrónico.
- País de origen o nacionalidad.
- Dirección.
- Foto o imagen de la licencia/documento, cuando sea posible.
- Fotografía del cliente, si se desea utilizar.

### 7.2 Perfil integral

Desde el perfil del cliente deben consultarse:

- Datos personales.
- Documentos y fotografías.
- Cotizaciones.
- Reservas.
- Rentas o contratos.
- Estado de contratos.
- Pagos, abonos y saldos relacionados.

### 7.3 Autocompletado

Al crear un contrato:

- Debe poder seleccionarse un cliente de la base de datos.
- Los datos existentes deben copiarse automáticamente al contrato.
- Solo deben colocarse los datos disponibles; un campo opcional faltante no debe impedir la generación.
- También debe existir la posibilidad de escribir los datos manualmente cuando sea necesario.

### 7.4 Persona natural y empresa

El cliente alquila tanto a personas naturales como a empresas. El sistema debe distinguir ambos casos.

Para una empresa deben poder manejarse, según corresponda:

- Nombre o razón social a facturar.
- Número de registro fiscal.
- NIT u otros datos tributarios aplicables.
- Persona de contacto.
- Conductor o conductores autorizados.
- Persona que recibe el vehículo.
- Persona que entrega o devuelve el vehículo.
- Firmas de recepción y devolución.

La nomenclatura fiscal exacta debe validarse con el cliente antes de cerrar el formulario.

### 7.5 Conductores adicionales

El contrato debe admitir uno o más conductores adicionales cuando la operación lo requiera, con sus datos y documentos correspondientes.

---

## 8. Módulo de vehículos

### 8.1 Datos solicitados

Cada vehículo debe permitir registrar:

- Marca.
- Modelo.
- Año.
- Tipo de vehículo.
- Placa.
- Chasis.
- VIN.
- Número de motor.
- Tipo de combustible.
- Aceite de motor.
- Kilometraje.
- Información de llantas.
- Fotografías.
- Estado de disponibilidad.

### 8.2 Kilometraje

- El kilometraje registrado durante una inspección o entrega debe poder actualizar el kilometraje actual del vehículo.
- Debe conservarse historial; no debe sobrescribirse la evidencia anterior.
- El kilometraje de salida y entrada debe permanecer asociado al contrato e inspección correspondientes.

### 8.3 Perfil del vehículo

Desde el perfil del vehículo deben consultarse:

- Datos generales.
- Fotografías.
- Reservas.
- Contratos.
- Inspecciones.
- Kilometraje histórico.
- Gastos.
- Historial de taller y mantenimiento.
- Repuestos comprados o instalados.
- Ingresos generados.
- Balance básico entre ingresos y gastos.

### 8.4 Publicación en la Landing Page

Debe existir una forma explícita de decidir qué vehículos de la flota aparecen públicamente en la Landing Page. La demostración enviada sirve como referencia funcional, pero el diseño no debe copiarse literalmente.

---

## 9. Cotizaciones

### 9.1 Requisitos funcionales

- Crear cotizaciones desde la plataforma administrativa.
- Vincular cada cotización a un cliente.
- No exigir una reserva asociada.
- Permitir conceptos, fechas, vehículo o tipo de vehículo, tarifas, cargos, descuentos permitidos, observaciones y vigencia.
- Calcular y presentar totales.
- Generar un formato formal en PDF.
- Elegir español o inglés.
- Compartir por WhatsApp, correo o descarga.
- Mantener historial de cotizaciones dentro del perfil del cliente.
- Registrar estado, por ejemplo:
  - Borrador.
  - Enviada.
  - Aceptada.
  - Rechazada.
  - Vencida.

### 9.2 Regla crítica

El estado “aceptada” no debe crear por sí solo una reserva ni un contrato.

---

## 10. Reservas y calendario

### 10.1 Creación manual

Las reservas son creadas por el personal de OLDES después de coordinar con el cliente.

### 10.2 Datos de una reserva

La reserva debe incluir:

- Cliente.
- Vehículo.
- Fecha y hora de entrega.
- Lugar de entrega.
- Fecha y hora de devolución.
- Lugar de devolución.
- Monto o tarifa en efectivo.
- Monto o tarifa con tarjeta.
- Costos e información adicional acordada.
- Estado de la reserva.
- Observaciones.

El teléfono no necesita escribirse nuevamente si ya existe en el perfil del cliente, pero debe poder consultarse rápidamente.

### 10.3 Pago en efectivo y tarjeta

- El sistema debe distinguir monto en efectivo y monto con tarjeta.
- El cliente informa que las operaciones con tarjeta no admiten el mismo descuento porque existen costos de POS e IVA.
- La comunicación pública indica un cargo de transacción del **10 %** para tarjetas.
- El efectivo es recomendado.

### 10.4 Calendario

El calendario debe mostrar:

- Entregas.
- Devoluciones.
- Reservas próximas.
- Vehículo asignado.
- Cliente.
- Horas y lugares acordados.
- Conflictos de disponibilidad.

---

## 11. Dashboard o pantalla inicial

La pantalla inicial debe funcionar como resumen operativo rápido.

Debe mostrar:

- Pendientes del día.
- Agenda de hoy.
- Próximas actividades, especialmente las del día siguiente.
- Vehículos que deben entregarse.
- Vehículos que deben recibirse.
- Clientes relacionados.
- Reservas próximas.
- Contratos actualmente abiertos.
- Acceso rápido para abrir o cerrar un contrato.
- Alertas de contratos que debieron cerrarse y continúan abiertos.

La intención es que el personal pueda tomar una tableta y comprender inmediatamente la operación del día, sin entrar primero al calendario.

---

## 12. Generación del contrato: experiencia esperada

El cliente solicita que la creación y entrega del contrato sea más amigable. Debe implementarse como un flujo guiado por pasos o componentes.

### 12.1 Inicio del flujo

La acción debe ser clara, por ejemplo:

- “Generar contrato”.
- “Entregar vehículo”.
- “Iniciar renta”.

El contrato se inicia únicamente cuando se entregará el vehículo.

### 12.2 Componente 1: arrendatario

Campos principales:

- Arrendatario.
- DUI o pasaporte.
- Licencia.
- Vencimiento.
- Teléfono.
- Dirección.
- Correo electrónico.
- Conductor adicional, cuando corresponda.
- Datos empresariales y de facturación, cuando corresponda.

Opciones:

- Elegir cliente de base de datos y autocompletar.
- Ingresar cliente manualmente.
- Incluir la fotografía del cliente o documento en el contrato, si se decide.

### 12.3 Componente 2: información del vehículo

Campos principales:

- Marca.
- Modelo.
- Placas.
- Tipo.
- Combustible.
- Nivel o evidencia de combustible de salida.
- Nivel o evidencia de combustible de entrada.

Opciones:

- Elegir vehículo de base de datos y autocompletar.
- Ingresar vehículo manualmente cuando sea necesario.

### 12.4 Inspección de entrega

Debe permitir:

- Registrar el estado exterior del vehículo.
- Marcar rayones, golpes y partes faltantes.
- Tomar fotografías.
- Tomar fotografía del tablero, marcador u odómetro.
- Registrar kilometraje manualmente.
- Registrar nivel de combustible.
- Adjuntar evidencia de daños.

### 12.5 Revisión de accesorios

La lista solicitada expresamente incluye:

- Llanta de repuesto.
- Mica.
- Palanca de mica.
- Cono.
- Extintor.
- Cables para corriente.

El sistema debe permitir marcar visualmente si cada accesorio:

- Se entrega.
- No se entrega.
- Se devuelve.
- Falta o presenta observación.

La lista debe ser configurable para que OLDES pueda añadir o retirar accesorios. Los formularios físicos muestran más elementos, pero no deben imponerse automáticamente si el cliente no los desea.

### 12.6 Términos y firma inicial

- Mostrar los términos y condiciones en un área legible y desplazable.
- Permitir su lectura completa.
- Registrar aceptación.
- Capturar firma digital al entregar el vehículo.
- Identificar quién firma.
- Guardar fecha y hora.

### 12.7 Documento PDF

- El contrato actual en papel es una referencia de orden y campos, no una plantilla que deba copiarse exactamente.
- El PDF puede ocupar dos o tres páginas.
- No es obligatorio comprimir toda la información en una sola página.
- Debe conservar jerarquía clara por componentes.
- Debe incluir el correlativo generado al momento de la entrega.
- Debe ser legible en pantalla y al imprimirse.

---

## 13. Inspección visual del vehículo

### 13.1 Objetivo

La inspección debe permitir que el cliente comprenda exactamente dónde se encuentra cada daño y evitar confusión sobre la parte señalada.

### 13.2 Representación gráfica

El cliente acepta una representación genérica por tipo de carrocería; no exige un modelo exclusivo para cada vehículo.

Como mínimo deben existir:

- Sedán de cuatro puertas y baúl.
- Pickup de cuatro puertas y palangana/cama.
- Otros tipos genéricos si la flota los necesita, por ejemplo microbús o SUV.

Puede utilizarse 2D o 3D, siempre que:

- La silueta sea reconocible.
- El lugar del daño sea fácil de comprender.
- El personal pueda marcar directamente rayones, golpes o faltantes.
- El resultado aparezca correctamente en el contrato.

Las imágenes enviadas de vistas frontal, trasera, laterales y superior sirven como referencia de claridad visual. El formulario amarillo enviado sirve como referencia para paneles y códigos de daño.

### 13.3 Códigos de identificación

- `0` = golpe.
- `+` = rayón.
- `x` = faltante.

### 13.4 Evidencia fotográfica

Las fotografías son evidencia crítica. Deben:

- Conservar detalle suficiente para distinguir rayones.
- Evitar una compresión agresiva que borre daños pequeños.
- Mostrar fecha, inspección, vehículo y etapa asociada.
- Permitir ampliación.
- Mantenerse protegidas y vinculadas al contrato.

### 13.5 Optimización y peso

El cliente solicita que las fotos no sobrecarguen la plataforma. La implementación debe:

- Conservar un archivo de evidencia con calidad adecuada.
- Corregir orientación automáticamente.
- Generar versiones optimizadas para pantalla y miniaturas.
- Cargar en la interfaz la versión adecuada al tamaño visible.
- Evitar transferir el archivo de máxima resolución cuando solo se necesita una miniatura.
- Mantener el original o una versión maestra con resolución suficiente para revisión de daños.
- Aplicar límites razonables de formato, resolución y tamaño sin sacrificar la visibilidad de rayones.

---

## 14. Cierre del contrato y devolución

Al recibir el vehículo y cerrar la renta, el sistema debe solicitar:

- Inspección de entrada.
- Nuevas fotografías.
- Fotografía del combustible o tablero.
- Kilometraje de entrada, ingresado manualmente.
- Nivel de combustible de entrada.
- Estado de accesorios.
- Daños nuevos.
- Observaciones.
- Cargos adicionales.
- Pago complementario.
- Saldo pendiente, si existe.
- Firma digital de renta finalizada.
- Nombre de la persona que entrega.
- Nombre de la persona que recibe.
- Fecha y hora de cierre.

El cierre debe comparar salida y entrada para facilitar la identificación de diferencias.

---

## 15. Facturación, cargos, abonos y saldos

### 15.1 Regla de tiempo

OLDES factura por períodos de **24 horas**. Ejemplo expresado: de hoy a las 5:00 p. m. a mañana a las 5:00 p. m. corresponde a un día.

El sistema puede calcular automáticamente los días facturables. El cliente también acepta la entrada manual si fuera necesaria.

### 15.2 Cuadro de facturación

Debe incluir:

- Fecha o período comprendido.
- Cantidad de días a facturar.
- Tarifa.
- Subtotal.
- Datos o conceptos adicionales.
- Otros cargos.
- Abonos.
- Total.
- Saldo.

### 15.3 Otros cargos

Debe ser posible agregar conceptos como:

- Combustible.
- Rayones.
- Golpes.
- Daños.
- Tiempo adicional.
- Otros cargos personalizados.

### 15.4 Observaciones

Debe existir un campo amplio para registrar notas como:

- Condiciones en que regresó el vehículo.
- Solicitudes del cliente.
- Acuerdos.
- Incidentes.
- Aclaraciones de entrega o devolución.

### 15.5 Documentos anexos

Debe permitirse adjuntar documentos, incluidos comprobantes, crédito fiscal o facturas cuando correspondan.

### 15.6 Abonos

El cliente solicita registrar abonos:

- Antes de la renta.
- Durante la renta.
- Al finalizar.

Cada abono debe incluir:

- Contrato relacionado.
- Fecha.
- Monto.
- Medio de pago.
- Observación.
- Comprobante, si existe.
- Usuario que lo registró.

El sistema debe calcular:

- Total del contrato.
- Total abonado.
- Diferencia pendiente.
- Pago complementario al cierre.
- Saldo que permanecerá pendiente.

Los abonos pueden mostrarse dentro del contrato y también en una sección independiente para facilitar su consulta.

---

## 16. Firmas digitales

Se requieren, como mínimo, dos momentos de firma:

1. **Firma de entrega y aceptación inicial**
   - Aceptación de términos y condiciones.
   - Confirmación del estado de salida.
   - Identidad del firmante.

2. **Firma de devolución y renta finalizada**
   - Confirmación de entrega del vehículo.
   - Estado de entrada.
   - Cargos, pagos y saldo final.
   - Identidad del firmante.

Para operaciones con empresas también debe quedar constancia de quién recibió y quién devolvió el vehículo.

---

## 17. Términos y condiciones

- El reverso del contrato físico enviado contiene los términos actuales.
- El cliente indicó que desea modificarlos y realizar un cambio completo para la versión digital.
- Los textos fotografiados no deben asumirse automáticamente como versión legal definitiva.
- La plataforma debe permitir mantener y actualizar la versión vigente.
- Cada contrato debe guardar la versión exacta de términos aceptada al firmarse.
- El texto legal definitivo queda pendiente de entrega y aprobación por parte del cliente.

---

## 18. Taller, mantenimiento y gastos por vehículo

El cliente actualmente controla esta información en Excel y solicita integrarla al sistema.

### 18.1 Historial de taller

Cada vehículo debe permitir crear registros o “cartas de taller” con:

- Fecha.
- Trabajo realizado.
- Reparación o mantenimiento.
- Repuestos comprados o utilizados.
- Costo.
- Kilometraje relacionado.
- Observaciones.
- Documentos o fotografías, cuando existan.

### 18.2 Consulta histórica

Debe poder saberse:

- Qué reparación se realizó.
- Qué repuesto se compró.
- Cuándo se realizó.
- Cuánto costó.
- Cuál era el kilometraje.

### 18.3 Balance del vehículo

El sistema debe ayudar a comparar:

- Ingresos generados por alquileres.
- Gastos de taller.
- Gastos de mantenimiento.
- Repuestos.
- Otros costos asociados.

El perfil del vehículo debe reunir contratos, inspecciones, taller y balance, de forma equivalente a cómo el perfil del cliente reúne sus cotizaciones y rentas.

---

## 19. Estadísticas y permisos

El video demostrativo muestra estadísticas, PIN administrativo y ocultamiento de datos financieros para empleados. Estas funciones no deben copiarse literalmente, pero expresan una necesidad razonable:

- La información financiera debe estar restringida por permisos.
- Un administrador puede consultar ingresos, gastos y rendimiento.
- Un empleado sin autorización no debe ver información financiera sensible.
- Los roles y permisos deben controlar las acciones disponibles.

Los indicadores concretos de estadísticas deben validarse antes de considerarse alcance obligatorio.

---

## 20. Requisitos de uso y experiencia

- Interfaz amigable y guiada.
- Uso cómodo desde computadora y tableta.
- Formularios divididos por pasos o componentes.
- Selección desde base de datos o ingreso manual cuando corresponda.
- Autocompletado para evitar escribir dos veces la misma información.
- Accesos rápidos desde el dashboard.
- Confirmaciones claras antes de cerrar contratos.
- PDF legible y organizado.
- No copiar de forma rígida la aplicación demostrada.
- Tomar de las referencias solamente las ideas útiles para el flujo de OLDES.

---

## 21. Requisitos de seguridad y trazabilidad

- Acceso autenticado al sistema administrativo.
- Roles y permisos.
- Protección especial para:
  - Documentos de identidad.
  - Licencias.
  - Fotografías de clientes.
  - Firmas.
  - Contratos.
  - Evidencia de inspección.
  - Información financiera.
- Registro de quién crea, modifica, firma, entrega, recibe o cierra cada operación.
- Conservación del historial de cambios relevantes.
- Evitar eliminar evidencia histórica cuando se actualice kilometraje, inspecciones o datos financieros.

---

## 22. Reglas que no deben implementarse incorrectamente

1. No mostrar una sucursal física inexistente.
2. No convertir una solicitud web directamente en reserva.
3. No convertir una cotización aceptada directamente en reserva.
4. No abrir un contrato al aceptar la cotización.
5. No generar el correlativo del contrato meses antes de la entrega.
6. No ligar obligatoriamente cada cotización a una reserva.
7. No copiar exactamente las herramientas mostradas en los videos.
8. No obligar a que el contrato PDF quepa en una sola página.
9. No exigir un modelo 3D exclusivo para cada marca y modelo.
10. No comprimir las fotografías hasta perder la visibilidad de rayones.
11. No publicar documentos privados o firmas como archivos públicos.
12. No asumir como definitivos los términos legales fotografiados.

---

## 23. Prioridades funcionales expresadas por el cliente

### Prioridad crítica

- Inspección clara del vehículo.
- Fotografías optimizadas sin perder evidencia.
- Flujo correcto de cotización, reserva y contrato.
- Generación del contrato al entregar.
- Autocompletado de cliente y vehículo.
- Firma inicial y firma final.
- Control de combustible, kilometraje y accesorios.
- Abonos, pago complementario y saldo.

### Prioridad alta

- Perfil integral del cliente.
- Calendario de reservas.
- Dashboard operativo.
- Historial de taller por vehículo.
- Cotizaciones bilingües.
- Envío por WhatsApp y correo.

### Prioridad posterior o sujeta a validación

- Estadísticas avanzadas.
- Indicadores de rendimiento.
- Detalles exactos de roles financieros.
- Más carrocerías genéricas para inspección.

---

## 24. Pendientes de confirmación con el cliente

1. Correo electrónico definitivo.
2. Proveedor y configuración del dominio.
3. Idioma predeterminado de la Landing Page.
4. Texto final de términos y condiciones.
5. Campos fiscales exactos para empresas.
6. Nomenclatura exacta de “Mica” y “Palanca de mica”.
7. Lista final configurable de accesorios.
8. Formato visual definitivo de la cotización.
9. Carrocerías adicionales requeridas además de sedán y pickup.
10. Indicadores financieros y estadísticas que formarán parte de la primera versión.
11. Política exacta para descuentos y cálculo de la tarifa con tarjeta.
12. Si la foto del cliente o licencia debe aparecer siempre en el PDF o solamente guardarse como expediente privado.

---

## 25. Criterios generales de aceptación

La solución se considerará alineada con lo solicitado cuando:

- Una solicitud pública llegue a atención sin crear reserva ni contrato.
- El personal pueda crear una cotización bilingüe y enviarla.
- La cotización aparezca en el perfil del cliente.
- El personal pueda crear manualmente una reserva con toda la información logística y económica.
- El contrato solo se genere al entregar el vehículo y reciba correlativo en ese momento.
- Cliente y vehículo puedan seleccionarse y autocompletarse.
- La entrega permita inspección, fotos, combustible, kilometraje, accesorios, términos y firma.
- La devolución permita repetir la inspección, comparar, registrar cargos, abonos, saldo y firma final.
- Las fotografías conserven detalle y la plataforma utilice versiones optimizadas.
- El dibujo del vehículo sea reconocible y permita localizar daños.
- El dashboard muestre agenda cercana y contratos abiertos.
- El perfil del vehículo muestre taller, gastos, contratos e ingresos.
- Los PDF puedan extenderse a varias páginas sin perder legibilidad.
- La Landing Page no muestre una ubicación física.

---

## 26. Fuentes revisadas

### Material escrito

- Mensaje consolidado del cliente con requisitos de Landing Page, clientes, vehículos, contrato, inspección, cotizaciones, reservas y flujo corregido.

### Audios revisados

- `WhatsApp Audio 2026-08-04 at 11.02.03 AM.ogg`
- `WhatsApp Audio 2026-08-04 at 11.04.31 AM.ogg`
- `WhatsApp Audio 2026-08-04 at 11.04.31 AM (1).ogg`
- `WhatsApp Audio 2026-08-04 at 11.04.32 AM (1).ogg`
- `WhatsApp Audio 2026-08-04 at 11.04.32 AM (2).ogg`
- `WhatsApp Audio 2026-08-08 at 4.04.46 PM.ogg`
- `WhatsApp Audio 2026-08-08 at 4.04.47 PM.ogg`
- `WhatsApp Audio 2026-08-08 at 4.04.47 PM (1).ogg`

### Videos revisados

- `WhatsApp Video 2026-08-04 at 11.04.28 AM.mp4`
- `WhatsApp Video 2026-08-04 at 11.05.09 AM.mp4`

### Imágenes revisadas

- Lámina de vistas frontal, trasera, laterales y superior de un sedán.
- Formulario físico frontal de contrato/alquiler OLDES.
- Formulario físico con accesorios, inspección, facturación, observaciones y firmas.
- Reverso del contrato con términos y condiciones.
- Formulario amarillo con siluetas de sedán/pickup y códigos de daños.

---

## 27. Nota final

Esta especificación busca conservar exactamente la intención operativa del cliente, incluso cuando la información original fue enviada en distintos momentos. Las correcciones más recientes tienen prioridad: la cotización no agenda ni abre contratos; la reserva la crea manualmente OLDES; y el contrato nace únicamente al entregar el vehículo.
