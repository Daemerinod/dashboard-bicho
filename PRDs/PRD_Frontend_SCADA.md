# Product Requirements Document (PRD) - Operator Station Dashboard (Frontend)

**Project:** B.I.C.H.O. TBM Supervisory Controller

**Component:** Surface Operator GUI (HMI/SCADA)

**Stack:** React, TypeScript, TailwindCSS, Vite

## 1. Product Vision & Scope

The Operator Station is the single point of control and monitoring for the UDD Tunnel Lab's Tunnel Boring Machine (TBM)[cite: 10, 11]. The system must report relevant telemetry at a rate of at least 0.1 Hz and allow the machine to be remotely controlled from the surface[cite: 10]. 

## 2. Architecture & Design Principles

### 2.1 Clean Architecture (Frontend)

*   **Domain/Models:** TypeScript interfaces must match the TBM Telemetry JSON structure.

*   **Infrastructure (Services):** A dedicated service layer `useTelemetry.ts` hook) must handle the asynchronous `fetch` logic.

*   **Presentation (UI):** React components must only consume the state provided by the service layer.

### 2.2 Visual Design & SCADA Strictness

*   **Theme:** Strict Dark Mode. Monospace fonts MUST be used for numerical data values.

*   **External Observer Requirement:** In addition to the GUI, the site layout must include an indication of whether the machine is energized that is simple enough for an untrained observer to understand (e.g., a stacklight wired directly to the 480V supply)[cite: 10].

## 3. TBC Safety & Compliance Requirements (CRITICAL)

### 3.1 Energized State & Power Loss (TBC Rules)

*   **Energized Indicator:** The GUI/HMI must include a clear indication of if the machine is energized[cite: 10].

*   **Power Loss Recovery:** In the event of machine power loss, the GUI must warn the operator of the issue and reconnect on reboot[cite: 10].

*   **Isolated Monitoring:** Because sensors and safety logic run on an isolated low-voltage DC bus, the GUI must be capable of displaying sensor diagnostics even when the main 480 VAC motion-producing systems are disabled[cite: 11].

### 3.2 Watchdog & Interlock Bounds (TBC Rules)

*   **10-Second Rule:** The system must actively monitor Critical IO on the IO List and throw an appropriate interlock if any Critical IO is unresponsive for greater than 10 seconds[cite: 10].

*   **Bounds Monitoring:** An interlock must also be thrown if any Critical IO exceeds interlock bounds[cite: 10].

*   **Override Mechanism:** Interlocks may be disabled on a case-by-case basis with approval from TBC competition inspectors; the GUI must support this override mechanism[cite: 10].

## 4. Dashboard Layout & Required Telemetry (Based on PDB Tests)

The layout must be a CSS Grid/Flexbox single-page dashboard. Based on the UDD Tunnel Lab Major Tests plan, the GUI must specifically visualize the following data streams:

1.  **Header/Status Bar:** Connectivity health, "Energized" status indicator[cite: 10], and general system state.

2.  **Propulsion & Excavation Widget:** 

    *   Thrust / slip[cite: 11].

    *   Inflatable bladder pressure[cite: 11].

    *   Motor current[cite: 11].

    *   Advance rate[cite: 11].

3.  **Steering Widget:** 

    *   Angle error[cite: 11].

    *   Actuator torque[cite: 11].

    *   Ring loads[cite: 11].

4.  **Safety & Interlocks Widget:** Displays active interlocks, unresponsive IO warnings (>10s)[cite: 10], and the TBC-approved interlock override toggle[cite: 10].