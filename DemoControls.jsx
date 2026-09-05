import React from "react";
import { AlertTriangle, CloudSnow, RotateCcw } from "lucide-react";

export default function DemoControls({ engine, triggerBlizzard, triggerGeneratorFailure, resetSystem }) {
  const actions = {
    triggerBlizzard: triggerBlizzard || engine?.triggerBlizzard,
    triggerGeneratorFailure: triggerGeneratorFailure || engine?.triggerGeneratorFailure,
    resetSystem: resetSystem || engine?.resetSystem,
  };
  return (
    <div className="demo-dock" id="scenario">
      <div className="dock-title">
        <span>DEMO CONTROLS</span>
        <small>Live crisis simulation</small>
      </div>
      <button className="control-btn storm" onClick={actions.triggerBlizzard}><CloudSnow size={16} /> Simulate -45°C Blizzard</button>
      <button className="control-btn failure" onClick={actions.triggerGeneratorFailure}><AlertTriangle size={16} /> Trigger Gen 1 Failure</button>
      <button className="control-btn reset" onClick={actions.resetSystem}><RotateCcw size={16} /> Reset System</button>
    </div>
  );
}