import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return <div style={{minHeight:"100vh",background:"#02070d",color:"#b9d5e4",fontFamily:"monospace",padding:"40px",boxSizing:"border-box"}}>
        <div style={{maxWidth:900,margin:"0 auto",border:"1px solid #29485c",background:"#07131f",padding:24}}>
          <div style={{color:"#ff6b76",letterSpacing:".12em",fontSize:12}}>PENGUIN / FRONTEND ERROR</div>
          <h1 style={{fontFamily:"sans-serif",fontWeight:500}}>The interface could not render.</h1>
          <p style={{color:"#7895a6"}}>Open the browser console and share this message if the problem persists.</p>
          <pre style={{whiteSpace:"pre-wrap",color:"#e7f5ff",fontSize:12}}>{String(this.state.error?.stack || this.state.error)}</pre>
        </div>
      </div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(<ErrorBoundary><App /></ErrorBoundary>);
