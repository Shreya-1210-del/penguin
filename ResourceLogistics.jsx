import React, { useState } from "react";
import { Box, Droplets, Package, ShieldCheck, Wrench, X } from "lucide-react";

const seed = [
  { id: "fuel-primary", label: "Primary fuel", value: 76, unit: "%", icon: Droplets, note: "Aggregate reserve. Backend-ready inventory field." },
  { id: "fuel-secondary", label: "Emergency fuel", value: 18, unit: "%", icon: Droplets, note: "Reserve buffer for abnormal operations." },
  { id: "ration", label: "Ration packs", value: 312, unit: "packs", icon: Package, note: "Inventory counter reserved for resource logistics integration." },
  { id: "spares", label: "Critical spares", value: 27, unit: "items", icon: Wrench, note: "Spare-part inventory placeholder for backend persistence." },
];

export default function ResourceLogistics() {
  const [items, setItems] = useState(seed);
  const [selected, setSelected] = useState(null);
  const adjust = (id, delta) => setItems((prev) => prev.map((item) => item.id === id ? { ...item, value: Math.max(0, item.value + delta) } : item));
  return (
    <section className="panel resource-panel" id="logistics">
      <div className="panel-head"><div><span className="eyebrow">RESOURCE & LOGISTICS</span><h2>Station reserves</h2></div><ShieldCheck size={18} className="green-icon" /></div>
      <div className="resource-grid">
        {items.map((item) => { const Icon = item.icon; return <button key={item.id} className="resource-card" onClick={() => setSelected(item)}><span className="resource-icon"><Icon size={16} /></span><span><b>{item.label}</b><small>{item.value} {item.unit}</small></span><i /></button>; })}
      </div>
      <div className="resource-actions">{items.slice(0, 2).map((item) => <div key={item.id} className="resource-adjust"><span>{item.label}</span><div><button onClick={() => adjust(item.id, -1)}>−</button><button onClick={() => adjust(item.id, 1)}>+</button></div></div>)}</div>
      {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><div className="modal" onClick={(e) => e.stopPropagation()}><button className="icon-btn modal-close" onClick={() => setSelected(null)}><X /></button><div className="modal-kicker"><Box size={15} /> INVENTORY RECORD</div><h3>{selected.label}</h3><div className="modal-status ok">BACKEND-READY FIELD</div><p>{selected.note}</p><div className="detail-metric"><span>VALUE</span><strong>{selected.value} {selected.unit}</strong></div></div></div>}
    </section>
  );
}
