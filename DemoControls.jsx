import React, { useState, useEffect } from "react";
import { AlertTriangle, CloudSnow, RotateCcw, Wrench } from "lucide-react";

export default function DemoControls({
  engine,
  startBlizzard,
  stopBlizzard,
  startGeneratorFailure,
  repairGenerator,
  resetSimulation,
  resetSystem,
}) {
  const [loadingAction, setLoadingAction] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  const isBlizzardActive = Boolean(
    engine?.activeScenarios?.blizzard ||
    engine?.scenario === "BLIZZARD" ||
    engine?.scenario === "COMBINED"
  );

  const isGenFailureActive = Boolean(
    engine?.activeScenarios?.generatorFailure ||
    engine?.generatorFailureActive ||
    engine?.generatorStatus === "CRITICAL"
  );

  const blizzardStartAction = startBlizzard || engine?.startBlizzard || engine?.triggerBlizzard;
  const blizzardStopAction = stopBlizzard || engine?.stopBlizzard;
  const failureStartAction = startGeneratorFailure || engine?.startGeneratorFailure || engine?.triggerGeneratorFailure;
  const failureRepairAction = repairGenerator || engine?.repairGenerator;
  const resetAction = resetSimulation || resetSystem || engine?.resetSimulation || engine?.resetSystem;

  useEffect(() => {
    if (!feedback && !error) return;
    const timer = setTimeout(() => {
      setFeedback(null);
      setError(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [feedback, error]);

  const handleAction = async (actionFn, actionName, successMsg) => {
    if (loadingAction || !actionFn) return;
    setLoadingAction(actionName);
    setError(null);
    try {
      await actionFn();
      setFeedback(successMsg);
    } catch (err) {
      setError(err?.message || `${actionName} failed`);
    } finally {
      setLoadingAction(null);
    }
  };

  const isBusy = Boolean(loadingAction || engine?.loading);

  return (
    <div className="demo-dock" id="scenario">
      <div className="dock-title">
        <span>DEMO CONTROLS</span>
        {error || engine?.scenarioError ? (
          <small style={{ color: "#f87171", fontWeight: 600 }}>
            {error || engine?.scenarioError}
          </small>
        ) : feedback || engine?.scenarioMessage ? (
          <small style={{ color: "#4ade80", fontWeight: 600 }}>
            {feedback || engine?.scenarioMessage}
          </small>
        ) : (
          <small>{isBusy ? "Executing request..." : "Live crisis simulation"}</small>
        )}
      </div>

      {/* Blizzard Toggle Button */}
      <button
        className={`control-btn storm ${isBlizzardActive ? "active" : ""}`}
        onClick={() =>
          handleAction(
            isBlizzardActive ? blizzardStopAction : blizzardStartAction,
            "blizzard",
            isBlizzardActive ? "Blizzard Stopped" : "Blizzard Activated"
          )
        }
        disabled={isBusy}
        style={{
          opacity: isBusy ? 0.5 : 1,
          cursor: isBusy ? "not-allowed" : "pointer",
          background: isBlizzardActive ? "rgba(245, 158, 11, 0.15)" : undefined,
          color: isBlizzardActive ? "#fbbf24" : undefined,
          borderColor: isBlizzardActive ? "rgba(245, 158, 11, 0.4)" : undefined,
        }}
      >
        <CloudSnow size={16} />
        {loadingAction === "blizzard"
          ? isBlizzardActive
            ? "Stopping..."
            : "Starting..."
          : isBlizzardActive
          ? "Stop Blizzard"
          : "Start Blizzard"}
      </button>

      {/* Generator Failure Toggle Button */}
      <button
        className={`control-btn failure ${isGenFailureActive ? "active" : ""}`}
        onClick={() =>
          handleAction(
            isGenFailureActive ? failureRepairAction : failureStartAction,
            "generator",
            isGenFailureActive ? "Generator Repaired" : "Generator Failure Activated"
          )
        }
        disabled={isBusy}
        style={{
          opacity: isBusy ? 0.5 : 1,
          cursor: isBusy ? "not-allowed" : "pointer",
          background: isGenFailureActive ? "rgba(239, 68, 68, 0.15)" : undefined,
          color: isGenFailureActive ? "#f87171" : undefined,
          borderColor: isGenFailureActive ? "rgba(239, 68, 68, 0.4)" : undefined,
        }}
      >
        {isGenFailureActive ? <Wrench size={16} /> : <AlertTriangle size={16} />}
        {loadingAction === "generator"
          ? isGenFailureActive
            ? "Repairing..."
            : "Triggering..."
          : isGenFailureActive
          ? "Repair Generator"
          : "Trigger Generator Failure"}
      </button>

      {/* Reset System Button */}
      <button
        className="control-btn reset"
        onClick={() => handleAction(resetAction, "reset", "Simulation Reset")}
        disabled={isBusy}
        style={{
          opacity: isBusy ? 0.5 : 1,
          cursor: isBusy ? "not-allowed" : "pointer",
        }}
      >
        <RotateCcw size={16} />
        {loadingAction === "reset" ? "Resetting..." : "Reset System"}
      </button>
    </div>
  );
}