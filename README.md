# Penguin Antarctic Digital Twin

A React/Vite frontend prototype for an Antarctic digital twin focused on Bharati and Maitri stations.

## Run on Windows

1. Extract the ZIP.
2. Open PowerShell inside the `penguin_build` folder, the folder containing `package.json`.
3. Run:

```powershell
npm install
npm run dev
```

4. Open the Vite localhost address shown in the terminal.

## Core features implemented from the supplied Technical Reference Manual

### 1. Dynamic Fuel & Physics Engine
- 120,000 L mock storage across 4 tanks.
- 45.0 L/h per active generator baseline.
- 3 active generators at baseline.
- 3 second update loop.
- Cold multiplier below -20°C:
  `1 + (|ambientTemperature| - 20) × 0.018`
- Fuel viscosity risk below -45°C.
- Scenario penalty multiplier.
- Survival calculation:
  `remaining fuel / (actual burn rate × 24)`
- Critical fuel alert below 15 days.
- Local mock data is isolated behind the React hook so a backend can later replace it.

### 2. Interactive 2D Station Layout Map
- SVG floor-plan style map.
- Generator Bay, Fuel Storage and Living Quarters.
- Click a zone for a diagnostic overlay.
- Hover a zone for distance from mission control.
- Generator failure flashes the generator zone red.
- Fuel Storage becomes warning below -35°C.
- Live status indicators and module metrics.

### 3. Emergency What-If Scenario Simulator
- Blizzard Level 5: -55°C and 1.45× scenario penalty.
- Primary Generator Failure: active units 3 → 1 and 2.0× failure penalty.
- Cascading survival and burn-rate recalculation.
- System Reset.
- Immediate state updates and event logging.

### 4. Central Command Dashboard & Live Analytics
- Aggregated station KPIs.
- Rolling 30-point telemetry history.
- Temperature, power/load and fuel/burn visualizations.
- Efficiency index calculation.
- Overload and inefficient-run warnings.
- Live alert memory.

## Extended frontend modules

- Interactive 3D digital twin with drag-to-orbit, zoom, top view and zone inspection.
- SatSync local/high-resolution and compressed modes.
- Raw and compact payload inspector.
- Predictive analytics.
- Resource and logistics panel.
- Satellite pass visualization.
- Backend integration contract.
- Real station image sources with local fallback assets.
- Opening mountain scene built from the supplied design reference so the hero does not depend on an external image request.

## Backend handoff

The UI uses a single telemetry-oriented state spine in `src/useAntarcticEngine.js`. Replace the mock interval with REST/WebSocket/MQTT adapters without changing the visual components. The PDF's real-world architecture references radar tank sensors, Modbus/OPC UA, InfluxDB, BMS/BACnet or MQTT, Open-Meteo/IMD weather data and station SCADA streams.

## Design notes

The hero intentionally separates the supplied mountain artwork from the UI text layer. This prevents the duplicated text and markers that previously caused visual overlap. The mountain crop is stored locally in `public/assets/hero-mountains.jpg`.
