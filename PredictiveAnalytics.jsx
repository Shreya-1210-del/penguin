import React, { useMemo } from "react";
import { BrainCircuit, CalendarClock, TrendingDown } from "lucide-react";

export default function PredictiveAnalytics({ history, currentFuel, burnRate }) {
  const forecast = useMemo(() => {
    if (history.length < 3) return { slope: 0, days: currentFuel / Math.max(burnRate, 1), confidence: 0 };
    const ys = history.map((p) => p.fuel); const n = ys.length;
    const xs = ys.map((_, i) => i); const mx = xs.reduce((a,b)=>a+b,0)/n; const my = ys.reduce((a,b)=>a+b,0)/n;
    const denom = xs.reduce((s,x)=>s+(x-mx)**2,0) || 1; const slope = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/denom;
    const intervalDays = 2 / 86400; const dailyLoss = Math.max(1, Math.abs(slope) / intervalDays); const days = currentFuel / dailyLoss;
    return { slope, days, confidence: Math.min(99, Math.round(55 + n * 2.1)) };
  }, [history, currentFuel, burnRate]);
  const date = new Date(Date.now() + Math.max(0, forecast.days) * 86400000);
  return <section className="panel predictive-panel" id="analytics"><div className="panel-head"><div><span className="eyebrow">PREDICTIVE ANALYTICS</span><h2>Reserve depletion forecast</h2></div><BrainCircuit size={18} className="blue-icon" /></div><div className="forecast-main"><div className="forecast-number">{forecast.days > 999 ? "999+" : forecast.days.toFixed(0)}<small>days</small></div><div className="forecast-copy"><span><CalendarClock size={13}/> projected depletion</span><b>{date.toLocaleDateString()}</b><small>Linear regression over the rolling telemetry history. Prototype forecast, not an operational guarantee.</small></div></div><div className="forecast-meta"><span><TrendingDown size={13}/> slope {forecast.slope.toFixed(1)} L / reading</span><span>confidence {forecast.confidence}%</span></div></section>;
}
