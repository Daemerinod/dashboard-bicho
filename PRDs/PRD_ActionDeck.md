# PRD: ActionDeck (Módulo de Comandos HMI SCADA)

## 1. Contexto y Objetivo

El Operator Dashboard actual monitorea telemetría pasivamente vía polling `GET /telemetry`. Para cumplir con las normativas de "Manual/Engineering Mode" y "Safe Restart" de The Boring Company (TBC), el HMI debe incorporar un panel de control interactivo (ActionDeck) que envíe comandos activos al backend mediante peticiones HTTP `POST`. La arquitectura debe ser agnóstica al hardware para su futura integración con los PLCs físicos.

## 2. Contrato de la API

### 2.1 Operación Normal `POST /command`)

Endpoint para comandos generales, control de motores y transiciones de estado.

**Request Payload:**

```typescript

interface CommandPayload {

  command: string; // ej. "power_on", "arm", "start_cutterhead", "inflate_bladder"

  params?: Record<string, any>; // ej. {"target": "READY"} para set_state

}

```

**Response Esperado:**

```typescript

interface CommandResponse {

  ok: boolean; // true si el comando fue aceptado, false si fue rechazado por un interlock

  message: string; // Razón del rechazo o confirmación de éxito

  command: string;

  state: string; // Estado resultante de la máquina (ej. "IDLE")

}

```

### 2.2 Emergencia Crítica `POST /api/plc/parada`)

Endpoint de máxima prioridad que fuerza el estado `E-STOPPED` saltándose la máquina de estados regular (simulando un puente de hardware directo).

**Request Payload:** 

```typescript

{ "source": "HMI_Operator" }

```

**Response Esperado:** Retorna status HTTP 200 de confirmación inmediata.

## 3. Entregables e Implementación Técnica

### A. Custom Hook `useCommand.ts`)

Crear un hook para manejar las peticiones POST de forma asíncrona hacia el backend (Vite proxy en `:8000`).

* Debe manejar el estado de carga `isPending`).

* Debe capturar errores de red (fetch failures).

* Debe retornar la respuesta tipada `CommandResponse`) para gestionar el feedback visual en la UI.

### B. Componente Visual `ActionDeck.tsx`)

Construir un panel de control compacto. Debe ubicarse en la mitad inferior de la pantalla o integrarse armónicamente cerca de la sección "Safety & Interlocks". Agrupación estricta de botones:

#### Grupo 1: Secuencia de Arranque Seguro (TBC Rule: Safe Restart)

Lógica condicional: Si el estado de la máquina es `E-STOPPED` o `POWER OFF`, bloquear todas las acciones de operación excepto la secuencia de rearme.

 *Botón* *[POWER ON]**: Envía `{"command": "power_on"}`.

 *Botón* *[ARM]**: Envía `{"command": "arm"}`. *Condición UI: Debe estar visualmente deshabilitado hasta que POWER ON sea exitoso y la máquina pida el segundo paso.*

#### Grupo 2: Transiciones de Estado

 *Botón* *[SET READY]**: Envía `{"command": "set_state", "params": {"target": "READY"}}`.

 *Botón* *[SET MINING]**: Envía `{"command": "set_state", "params": {"target": "MINING"}}`.

#### Grupo 3: Control Manual de Subsistemas

 *Botón* *[TOGGLE CUTTERHEAD]**: Envía `{"command": "start_cutterhead"}` (o `stop` si prefieres separarlos).

 *Botones* *[INFLATE BLADDER]** / **[DEFLATE BLADDER]**: Envían los comandos respectivos de presión.

#### Grupo 4: Seguridad Crítica

 *Botón Masivo* *[ENGAGE E-STOP]**: Botón prominente que invoca a `POST /api/plc/parada`.

 *Botón* *[INTERLOCK OVERRIDE]**: Convierte el 'stub' actual en un botón que envíe una solicitud de bypass al backend, previa advertencia de confirmación simple.

## 4. Requerimientos de UX/UI y Feedback (Zero-Vibecoding)

* **Feedback de Interlocks (Crucial):** Si la respuesta de `/command` devuelve `ok: false`, la UI **DEBE** inyectar el `message` del servidor en un componente visual de alerta (Toast o Banner temporal rojo/amarillo) visible por 3 a 5 segundos para que el operador sepa por qué se rechazó su comando.

* **Diseño Industrial SCADA:** 

  * Botones con bordes afilados `rounded-none` o máximo `rounded-sm`).

  * Fuente `font-mono` obligatoria para todos los textos de los botones.

  * Sin animaciones suaves prolongadas; la interfaz debe sentirse táctica e instantánea.

* **Paleta Semántica:** 

  * E-STOP: Fondo rojo puro `bg-red-600`), texto blanco, peso visual máximo.

  * Acciones Críticas/Arranque (POWER ON, ARM): Verde esmeralda `bg-emerald-600`).

  * Deshabilitado: Gris profundo `bg-neutral-800`, `opacity-50`, `cursor-not-allowed`).