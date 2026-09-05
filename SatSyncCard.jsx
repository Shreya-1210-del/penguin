import React, { useMemo } from "react";
import { ArrowDownToLine, CheckCircle2, Radio, Server, ShieldCheck } from "lucide-react";
import { getCompressedPayload, getPayloadMetrics, getRawPayload } from "./satSyncUtils";

export default function SatSyncCard({ engine }) {
  const raw = useMemo(() => getRawPayload(engine), [
    engine.currentFuel, engine.ambientTemp, engine.generatorStatus, engine.actualBurnRate, engine.survivalDays, engine.powerDraw
  ]);
  const compressed = useMemo(() => getCompressedPayload(engine), [
    engine.currentFuel, engine.ambientTemp, engine.generatorStatus
  ]);
  const metrics = useMemo(() => getPayloadMetrics(engine), [
    engine.currentFuel, engine.ambientTemp, engine.generatorStatus, engine.actualBurnRate, engine.survivalDays, engine.powerDraw
  ]);

  const active = engine.isSatSyncMode;

  return (
    <section className="panel satsync-panel" id="satsync">
      <div className="panel-head">
        <div>
          <span className="eyebrow">SATELLITE CONSTRAINT</span>
          <h2>SatSync transmission</h2>
        </div>
        <div className={`protocol-chip ${active ? "on" : ""}`}><Radio size={14} /> {active ? "COMPRESSED" : "LOCAL HIGH-RES"}</div>
      </div>

      <div className="sync-toggle-row">
        <div className="sync-copy">
          <strong>{active ? "SatSync Compressed Mode" : "Local High-Res Mode"}</strong>
          <span>{active ? "Critical deltas only · simulated low-bandwidth uplink" : "Full telemetry stream · local operator view"}</span>
        </div>
        <button className={`switch ${active ? "active" : ""}`} onClick={() => engine.setIsSatSyncMode(!active)} aria-label="Toggle SatSync">
          <span />
        </button>
      </div>

      <div className="payload-grid">
        <div className="json-card">
          <div className="json-top"><span><Server size={14} /> PAYLOAD</span><span>{active ? `${metrics.compressedBytes} B` : `${metrics.rawBytes} B`}</span></div>
          <pre>{active ? compressed : JSON.stringify(raw, null, 2)}</pre>
        </div>

        <div className="compression-card">
          <div className="compression-ring">
            <ArrowDownToLine size={18} />
            <strong>{metrics.reduction.toFixed(1)}%</strong>
            <span>smaller</span>
          </div>
          <div className="bandwidth-rows">
            <div><span>Raw stream</span><b>{metrics.simulatedRawRate}</b></div>
            <div><span>SatSync</span><b>{metrics.simulatedCompressedRate}</b></div>
          </div>
          <div className="proof-line"><ShieldCheck size={15} /> Live byte calculation from JSON payload</div>
        </div>
      </div>

      <div className="demo-disclaimer">
        <CheckCircle2 size={14} />
        SatSync is a UI simulation of the bandwidth constraint for the prototype; it does not throttle a real network connection.
      </div>
    </section>
  );
}