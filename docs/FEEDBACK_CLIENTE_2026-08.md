# Feedback cliente OLDES — consolidado (agosto 2026)

Fuente: audios transcritos por el operador + PDFs:
- `d:\DESCARGAS\contrato_arrendamiento_vehiculo.pdf`
- `d:\DESCARGAS\Recibo_de_Pago_o_Abono.pdf`

---

## Prioridad explícita del cliente

1. **Entregar / pulir la LANDING primero** (mayor alcance comercial).
2. Continuar el sistema sin pausarlo del todo.
3. Contratos/recibos/inspección según machotes PDF (contenido/estructura, no layout ChatGPT literal).

---

## A. Landing page

| Pedido | Decisión |
|--------|----------|
| Hero más limpio | Imagen real de vehículo (Prado / CX-9 / Wrangler), poca tipografía |
| Eslogan | “Operador logístico siempre entregando lo mejor” (o sin eslogan + foco visual) |
| Tipos de carro | Más ordenados |
| **Precios visibles** | **SÍ volver a mostrar** (cambia decisión anterior de ocultarlos) |
| FAQ | Sección editable por el cliente (o fácil de editar) |
| Teléfono | Mantener +503 |

---

## B. Cotización automática por WhatsApp (autobot)

- Cliente pide: solicitud web → cotización automática → respuesta en el mismo chat WhatsApp del negocio.
- **Alcance:** integración WhatsApp Business API / chatbot (Meta, Twilio, etc.).
- **Estado:** fase aparte / cotizable. No bloquea landing ni contrato PDF.
- Respuesta al cliente: “sí es posible, requiere cuenta Business + API; se puede planear como fase 2”.

---

## C. Contrato / inspección (machote PDF)

Referencia: `contrato_arrendamiento_vehiculo.pdf`

1. **Quitar vista 3D** → solo esquema 2D convencional.
2. **Fotos anexas al final** del PDF (contrato corrido imprimible).
3. **Layout en secciones 1 / 2** (datos arrendatario | vehículo+facturación) — no solo “slots” verticales saturados.
4. **Combustible por fracciones de tanque** (E, 1/8, 1/4, 3/8… F), no porcentaje.
5. **Checklist con “chequeosito”** (✓ presente / no está / averiado) — rápido en aeropuerto, sin menús profundos.
6. **Términos y condiciones** = hoja completa del cliente (firmas ahí); frente más visual (vehículo + checklist).
7. **Pagarés** fuera del PDF digital (él los hace aparte / notariales).
8. **Firma del operador**: auto desde perfil (nombre + firma digital cargada al crear usuario).
9. Idioma: preferencia **un solo idioma** (ES); traducción si hace falta después.
10. Leyenda: “se anexan fotos de comprobación de entrega” cerca de firmas.

---

## D. Acta de cierre

- Condiciones de devolución.
- Diagrama **entrega vs recepción** (rayones/golpes).
- Fotos anexas de cómo se recibió.
- Resto del acta le parece bien.

---

## E. Recibos (machote PDF)

Referencia: `Recibo_de_Pago_o_Abono.pdf`

Estructura objetivo:
1. Datos cliente + referencia (contrato, vehículo, placa)
2. Monto + suma en letras
3. Forma de pago + concepto (abono / cancelación / extensión / otro)
4. Estado de cuenta (total / abonado hoy / saldo)
5. Firmas empresa + cliente + envío WhatsApp/correo

También: slot de autorización para **no cobrar horas extras / cortesías** (parcialmente ya en cierre).

---

## F. Proveedores / subarrendo

- Vehículo de tercero: costo al proveedor, **no contar como ganancia propia**.
- Ideal: proveedor ve reservas y saldo (si no es muy complejo, al menos contabilidad correcta).
- Cliente tiene Excel de utilidad — alinear reportes.

---

## G. Cotización automática WhatsApp (fase 2)

**Pedido:** cuando el cliente pide cotización, un bot responde en el mismo chat de WhatsApp Business con la cotización y queda el hilo.

**Requiere:** Meta WhatsApp Business API (o Twilio/360Dialog), plantillas aprobadas, y reglas de precio por tipo/días.

**Estado:** documentado; no bloquea landing ni contratos. Se cotiza e implementa como módulo aparte cuando el cliente active la cuenta Business.