const rawApi = import.meta.env.VITE_PENGUIN_API_URL || import.meta.env.VITE_INTELLIGENCE_API_URL || "";
const API = rawApi ? rawApi.replace(/\/$/, "") : "";

async function request(path, options = {}) {
  let response;
  const url = `${API}${path}`;
  try {
    response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
  } catch (networkError) {
    throw new Error("PENGUIN_API_UNREACHABLE");
  }
  if (!response.ok) {
    let detail = "";
    try { detail = (await response.json())?.detail || ""; } catch { /* ignore */ }
    throw new Error(detail || `Penguin API ${response.status}`);
  }
  return response.json();
}

// Existing (kept stable for backward compatibility)
export const predictResources = (payload) => request("/api/ml/predict-resources", { method: "POST", body: JSON.stringify(payload) });
export const compareScenarios = (payload) => request("/api/ml/scenario-compare", { method: "POST", body: JSON.stringify(payload) });
export const getModelInfo = () => request("/api/ml/model-info");
export const chatWithPenguin = (message, context) => request("/api/assistant/chat", { method: "POST", body: JSON.stringify({ message, context }) });
export const getFacts = (category) => request(`/api/assistant/facts${category ? `?category=${encodeURIComponent(category)}` : ""}`);
export const getApiBase = () => API;

// New
export const getForecast = (payload) => request("/api/ml/forecast", { method: "POST", body: JSON.stringify(payload) });
export const getRecommendation = (payload) => request("/api/ml/recommend", { method: "POST", body: JSON.stringify(payload) });
export const getMetrics = () => request("/api/ml/metrics");
export const getFeatureImportance = () => request("/api/ml/feature-importance");
export const getRandomFact = (category) => request(`/api/assistant/facts/random${category ? `?category=${encodeURIComponent(category)}` : ""}`);
export const trainModel = (rows, seed) => request("/api/ml/train", { method: "POST", body: JSON.stringify({ rows, seed }) });

// Small helper so callers can debounce/deduplicate rapid slider-driven calls.
export function debounce(fn, wait = 350) {
  let timer = null;
  const debounced = (...args) => {
    clearTimeout(timer);
    return new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        fn(...args).then(resolve).catch(reject);
      }, wait);
    });
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
