"""
Grounded knowledge base for the Penguin AI Assistant.

Design goal (Part 12, GROUNDED AI): every answer must be traceable to one of four
buckets, and the assistant must say which bucket(s) it drew from:

  KNOWN_PROJECT_INFORMATION   -- facts stated in the supplied project material (docs/README)
  SYNTHETIC_PROTOTYPE_DATA    -- numbers computed from the synthetic model/telemetry
  GENERAL_KNOWLEDGE           -- general, non-station-specific facts (what is a digital twin, etc.)
  UNKNOWN_UNAVAILABLE         -- explicitly says the prototype does not have this information

Retrieval uses TF-IDF + cosine similarity over a small hand-written knowledge base
(no external LLM required). This is a deliberate choice for a demo: it is fully local,
deterministic (same question -> same answer), needs no API key, and is easy to audit --
you can read every sentence it is capable of returning.

An OPTIONAL production LLM path is included (guarded by OPENAI_API_KEY) for when a
richer, less scripted assistant is wanted -- see try_llm_answer(). If the key is not
set, or the call fails for any reason, the app transparently falls back to the
grounded local pipeline below, so the demo never depends on network access or a key.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ---------------------------------------------------------------------------
# Knowledge base. Each item is tagged with an information_type bucket.
# ---------------------------------------------------------------------------
KNOWN = "KNOWN_PROJECT_INFORMATION"
SYNTHETIC = "SYNTHETIC_PROTOTYPE_DATA"
GENERAL = "GENERAL_KNOWLEDGE"
UNKNOWN = "UNKNOWN_UNAVAILABLE"

KNOWLEDGE: list[dict[str, str]] = [
    {
        "topic": "digital twin",
        "category": "Digital Twin",
        "information_type": GENERAL,
        "text": "A digital twin is a virtual representation of a physical asset, kept in sync with (or approximating) that asset's state so people can monitor, understand, and rehearse decisions about it without touching the real thing. Penguin is a digital twin prototype for India's Bharati and Maitri Antarctic research stations, built on synthetic telemetry because real internal station telemetry is not publicly available.",
    },
    {
        "topic": "penguin overview",
        "category": "Digital Twin",
        "information_type": KNOWN,
        "text": "Penguin is a prototype Antarctic Digital Twin covering both of India's Antarctic stations, Bharati and Maitri. It combines a live simulated dashboard, an interactive map, a 3D twin view, emergency what-if tooling, and a resource-intelligence ML layer, all running on synthetic operating data.",
    },
    {
        "topic": "dynamic fuel consumption",
        "category": "Operations",
        "information_type": SYNTHETIC,
        "text": "Dynamic Fuel Consumption estimates how long the synthetic station fuel reserve can last. It periodically updates mock conditions and applies cold-weather and emergency multipliers to the fuel burn rate, the same multipliers the ML resource model was trained on.",
    },
    {
        "topic": "cold multiplier",
        "category": "Operations",
        "information_type": SYNTHETIC,
        "text": "In the prototype, fuel burn is unaffected by cold down to -20C. Below -20C, burn rises linearly: roughly 1.8% more fuel per generator for every additional degree colder than -20C.",
    },
    {
        "topic": "blizzard",
        "category": "Operations",
        "information_type": SYNTHETIC,
        "text": "The Blizzard scenario drives ambient temperature sharply down, adds a wind-driven burn penalty that scales with a 0-5 blizzard severity slider, and raises resource demand across diesel, power, and medical supplies. In the station map view, the Fuel Tank Reserve moves into a warning state.",
    },
    {
        "topic": "generator failure",
        "category": "Operations",
        "information_type": SYNTHETIC,
        "text": "The Generator Failure scenario reduces the number of active generators (typically from 3 to 1) and applies roughly double the normal burn penalty per remaining generator, since fewer generators must cover the same station load less efficiently. The Generator Bay indicator becomes critical and the resource forecast raises its contingency requirement.",
    },
    {
        "topic": "generator efficiency",
        "category": "Operations",
        "information_type": SYNTHETIC,
        "text": "Generator efficiency in the prototype represents mechanical degradation, separate from an outright failure. As efficiency drops below 100%, the same generator burns proportionally more fuel to deliver the same power output -- a generator at 60% efficiency burns roughly 1.67x the fuel of one at 100%.",
    },
    {
        "topic": "station map",
        "category": "Digital Twin",
        "information_type": KNOWN,
        "text": "The interactive 2D station map divides the prototype into zones such as the Generator Bay, Fuel Tank Reserve, and Living Quarters, and colors each zone by its current simulated status (normal, warning, critical).",
    },
    {
        "topic": "3d digital twin",
        "category": "Digital Twin",
        "information_type": KNOWN,
        "text": "The Interactive 3D Digital Twin renders a spatial view of the station so operators can see zone status and layout together, complementing the flat 2D map and the numeric dashboards.",
    },
    {
        "topic": "satsync",
        "category": "Technology",
        "information_type": KNOWN,
        "text": "SatSync is a prototype concept for low-bandwidth telemetry: it compares a detailed local payload against a compact transmission payload and shows the simulated data reduction achieved, illustrating the kind of compromise a real satellite uplink from Antarctica would need to make.",
    },
    {
        "topic": "payload inspector",
        "category": "Technology",
        "information_type": KNOWN,
        "text": "The Payload Inspector lets a user look inside the simulated data packets the station would transmit, useful for understanding what SatSync is actually compressing and sending.",
    },
    {
        "topic": "satellite pass windows",
        "category": "Technology",
        "information_type": KNOWN,
        "text": "Satellite Pass Windows show when a satellite would be overhead and available for communication in the prototype's simulated schedule, framing why telemetry updates are periodic rather than continuous.",
    },
    {
        "topic": "bharati",
        "category": "Station",
        "information_type": KNOWN,
        "text": "Bharati is one of India's two staffed Antarctic research stations represented in Penguin. The supplied project material documents its prototype reference coordinate as 69°24' S / 76°11' E. Penguin uses this as station reference data only -- it does not claim access to Bharati's private operational telemetry.",
    },
    {
        "topic": "maitri",
        "category": "Station",
        "information_type": KNOWN,
        "text": "Maitri is one of India's two staffed Antarctic research stations represented in Penguin. The supplied project material documents its prototype reference coordinate as 70°45' S / 11°44' E. Penguin uses this as station reference data only -- it does not claim access to Maitri's private operational telemetry.",
    },
    {
        "topic": "antarctica general",
        "category": "Antarctica",
        "information_type": GENERAL,
        "text": "Antarctica is the coldest, windiest, and driest continent, with no permanent population -- everyone present is there for research or logistics, typically on multi-month rotations, which is exactly the kind of resource-planning problem Penguin's fuel and supply forecasting is meant to illustrate.",
    },
    {
        "topic": "ml prediction",
        "category": "Research",
        "information_type": SYNTHETIC,
        "text": "The Resource Intelligence model is a RandomForest ensemble trained on synthetic operational states covering normal, cold, blizzard, generator-failure, and other regimes. It estimates diesel, power, ration, medical, and spares demand for a chosen planning horizon. It is a contingency-planning aid, not a claim about real, classified, or private station demand.",
    },
    {
        "topic": "survival days",
        "category": "Operations",
        "information_type": SYNTHETIC,
        "text": "\"Survival days\" (or reserve endurance) is the current simulated fuel level divided by the current effective burn rate -- in plain terms, how many days the fuel would last if nothing changed. It falls when temperature drops, a scenario is triggered, or generator efficiency degrades, because each of those raises the burn rate in the denominator.",
    },
    {
        "topic": "risk level",
        "category": "Operations",
        "information_type": SYNTHETIC,
        "text": "Risk level in the prototype is a simple, explainable bucket derived from survival days and active scenario: STABLE when reserves comfortably outlast the planning horizon, WATCH as they tighten, HIGH once an emergency scenario or a shorter runway is active, and CRITICAL when survival days fall below the configured threshold or multiple emergencies compound.",
    },
    {
        "topic": "feature importance",
        "category": "Research",
        "information_type": SYNTHETIC,
        "text": "Feature importance here is derived directly from the trained RandomForest models (scikit-learn's feature_importances_), not hand-picked. It reflects which inputs most reduce prediction error across the synthetic training set, and is combined with how unusual the current inputs are to explain a specific prediction.",
    },
    {
        "topic": "frontend backend",
        "category": "Technology",
        "information_type": KNOWN,
        "text": "The React frontend calls a separate FastAPI intelligence backend over a defined API boundary. The backend owns model training, inference, and the grounded assistant service, and is designed to later connect to authorized telemetry, weather APIs, databases, or a production language model without changing the dashboard itself.",
    },
    {
        "topic": "prototype disclaimer",
        "category": "Research",
        "information_type": UNKNOWN,
        "text": "Penguin is a prototype. It intentionally uses synthetic operational telemetry and synthetic training data because real internal Bharati/Maitri telemetry is not publicly available. It should not be interpreted as, or treated as a source of, real or classified station data.",
    },
]

FACTS: list[dict[str, str]] = [
    {"category": "Station", "text": "Bharati and Maitri are the two Indian Antarctic stations represented in the Penguin prototype."},
    {"category": "Station", "text": "The supplied prototype coordinates are 69°24' S / 76°11' E for Bharati and 70°45' S / 11°44' E for Maitri."},
    {"category": "Antarctica", "text": "Antarctica has no permanent residents -- everyone there, at any station, is on a research or logistics rotation."},
    {"category": "Research", "text": "Penguin intentionally uses synthetic operational telemetry for the prototype rather than private or classified station telemetry."},
    {"category": "Technology", "text": "SatSync demonstrates how a compact payload could support constrained, intermittent satellite communications from a remote station."},
    {"category": "Digital Twin", "text": "A digital twin's value isn't just visualization -- it's letting people rehearse 'what happens if...' decisions safely before they matter for real."},
    {"category": "Operations", "text": "The resource model is designed to answer both 'what will we need?' and 'how much extra will an emergency cost us?' in the same forecast."},
    {"category": "Research", "text": "The Resource Intelligence engine's feature importances come directly from the trained RandomForest models, not from a manually assigned weighting."},
]

CATEGORY_KEYWORDS = {
    "Station": ["bharati", "maitri", "station", "coordinate", "location"],
    "Antarctica": ["antarctica", "antarctic", "continent", "cold", "ice", "climate"],
    "Research": ["research", "model", "ml", "prediction", "accuracy", "metric", "feature importance", "science"],
    "Technology": ["satsync", "payload", "satellite", "bandwidth", "technology", "api", "backend", "frontend"],
    "Digital Twin": ["digital twin", "3d", "twin", "map", "simulation", "visualiz"],
    "Operations": ["fuel", "generator", "blizzard", "burn", "survival", "risk", "reserve", "emergency", "power", "ration", "medical", "spares"],
}

_REAL_TELEMETRY_PATTERN = re.compile(
    r"\b(actual|real|true|classified|private|live)\b.{0,30}\b(fuel|telemetry|temperature|data|reading|level)\b",
    re.IGNORECASE,
)

_vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
_KB_MATRIX = _vectorizer.fit_transform([item["text"] for item in KNOWLEDGE])


def categorize(question: str) -> str:
    q = question.lower()
    best_cat, best_hits = "Operations", 0
    for cat, keywords in CATEGORY_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in q)
        if hits > best_hits:
            best_cat, best_hits = cat, hits
    return best_cat if best_hits > 0 else "General"


def retrieve(question: str, top_k: int = 3, min_score: float = 0.05) -> list[dict]:
    q_vec = _vectorizer.transform([question])
    scores = cosine_similarity(q_vec, _KB_MATRIX)[0]
    order = np.argsort(scores)[::-1][:top_k]
    return [
        {**KNOWLEDGE[i], "score": float(scores[i])}
        for i in order
        if scores[i] > min_score
    ]


def suggested_questions(category: str) -> list[str]:
    base = [
        "Explain the current station status",
        "Why is fuel consumption changing?",
        "What happens during a blizzard?",
    ]
    extra = {
        "Station": ["Tell me something interesting about Maitri", "Tell me something interesting about Bharati"],
        "Operations": ["What resource should we prepare?", "What does survival days mean?"],
        "Research": ["Explain this prediction", "How accurate is the model?"],
        "Technology": ["What is SatSync?", "How does the frontend talk to the backend?"],
        "Digital Twin": ["What does the 3D twin show?", "What is a digital twin?"],
    }.get(category, ["What is a digital twin?", "What does the 3D twin show?"])
    return base + extra


def _context_sentences(context: dict[str, Any]) -> list[str]:
    bits = []
    if context.get("station"):
        bits.append(f"the active station is {context['station']}")
    if context.get("ambientTemp") is not None:
        bits.append(f"ambient temperature is currently simulated at {context['ambientTemp']}°C")
    if context.get("survivalDays") is not None:
        bits.append(f"the current survival estimate is {context['survivalDays']} days")
    if context.get("scenario"):
        bits.append(f"the active scenario is {context['scenario']}")
    if context.get("generatorStatus"):
        bits.append(f"generator status is {context['generatorStatus']}")
    if context.get("riskLevel"):
        bits.append(f"risk level is currently {context['riskLevel']}")
    return bits


def _explain_risk_from_context(context: dict[str, Any]) -> str | None:
    """When the user asks a "why" question, reference the actual current numbers
    passed in from the dashboard rather than a generic answer."""
    reasons = []
    temp = context.get("ambientTemp")
    scenario = context.get("scenario")
    gen_status = context.get("generatorStatus")
    survival = context.get("survivalDays")

    if temp is not None and float(temp) < -35:
        reasons.append(f"ambient temperature is a severe {temp}°C, which sharply raises fuel burn")
    if scenario and str(scenario).upper() not in ("NORMAL", ""):
        reasons.append(f"the {str(scenario).replace('_', ' ').title()} scenario is active, which adds an emergency demand penalty")
    if gen_status and str(gen_status).upper() not in ("NORMAL", "OK", ""):
        reasons.append(f"generator status is reported as {gen_status}, reducing available power margin")
    if survival is not None:
        try:
            if float(survival) < 30:
                reasons.append(f"the current survival estimate has dropped to {survival} days")
        except (TypeError, ValueError):
            pass

    if not reasons:
        return None
    if len(reasons) == 1:
        return f"Based on the current simulated state, risk is elevated because {reasons[0]}."
    return "Based on the current simulated state, risk is elevated because " + "; and ".join(reasons) + "."


def is_ready() -> bool:
    try:
        return len(KNOWLEDGE) > 0 and len(FACTS) > 0 and _vectorizer is not None and _KB_MATRIX is not None
    except Exception:
        return False


def try_llm_answer(question: str, context: dict[str, Any], knowledge_snippets: list[dict]) -> str | None:
    """Optional production LLM path. Guarded entirely behind OPENAI_API_KEY.
    Returns None (never raises) if the key is absent, dummy, or the call fails for any reason,
    so the caller always has a deterministic local fallback available."""
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key or api_key.lower() in ("your_openai_api_key_here", "sk-placeholder", "none", "null") or len(api_key) < 15:
        return None
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    try:
        grounding = "\n".join(f"- {item['text']}" for item in knowledge_snippets) or "(no matching knowledge base entries)"
        system_prompt = (
            "You are Penguin AI, an assistant embedded in a prototype Antarctic digital twin dashboard "
            "for India's Bharati and Maitri stations. Answer simply, for a non-technical user. "
            "Only use the grounding notes and dashboard context given below; if asked for real/actual/classified "
            "station telemetry, say plainly that this prototype only has synthetic data. "
            f"Grounding notes:\n{grounding}\nCurrent dashboard context: {json.dumps(context)}"
        )
        body = json.dumps(
            {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question},
                ],
                "temperature": 0.3,
                "max_tokens": 300,
            }
        ).encode("utf-8")
        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=body,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
            return payload["choices"][0]["message"]["content"].strip()
    except Exception:
        return None


def compose_answer(question: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    context = context or {}
    question = question.strip()
    category = categorize(question) if question else "General"

    if not question:
        return {
            "answer": "Ask me about Penguin, the stations, fuel, emergencies, SatSync, ML predictions, or the dashboard.",
            "category": "General",
            "confidence": 0.0,
            "information_type": UNKNOWN,
            "sources": [],
            "context_used": False,
            "suggested_questions": suggested_questions("General"),
        }

    # Part 12 -- never pretend to have real telemetry.
    if _REAL_TELEMETRY_PATTERN.search(question):
        answer = (
            "This prototype does not have access to real Bharati or Maitri operational telemetry -- that data "
            "is not publicly available. Everything shown, including fuel level and temperature, is synthetic "
            "prototype data generated to demonstrate how the dashboard and ML model would behave with real inputs."
        )
        return {
            "answer": answer,
            "category": category,
            "confidence": 1.0,
            "information_type": UNKNOWN,
            "sources": [],
            "context_used": False,
            "suggested_questions": suggested_questions(category),
        }

    matches = retrieve(question)
    context_used = False

    if re.search(r"\bwhy\b.{0,20}\b(risk|critical|danger|unsafe)\b", question, re.IGNORECASE):
        risk_explanation = _explain_risk_from_context(context)
        if risk_explanation:
            context_used = True
            answer = risk_explanation
            info_type = SYNTHETIC
            sources: list[str] = []
        elif matches:
            answer, info_type, sources = matches[0]["text"], matches[0]["information_type"], [matches[0]["topic"]]
        else:
            answer = "Risk is currently low in the simulated state -- no severe temperature, scenario, or generator issue is active right now."
            info_type, sources = SYNTHETIC, []
    else:
        llm_answer = try_llm_answer(question, context, matches)
        if llm_answer:
            answer = llm_answer
            info_type = KNOWN if matches else GENERAL
            sources = [m["topic"] for m in matches]
            context_used = bool(context)
        elif matches:
            answer = matches[0]["text"]
            info_type = matches[0]["information_type"]
            sources = [m["topic"] for m in matches]
        else:
            answer = (
                "I can explain Penguin in simple language. Try asking about dynamic fuel consumption, the station "
                "map, blizzard or generator-failure scenarios, SatSync, ML resource predictions, Bharati, or Maitri."
            )
            info_type, sources = UNKNOWN, []

    live_bits = _context_sentences(context)
    if live_bits and not context_used:
        answer += "\n\nLive prototype context: " + "; ".join(live_bits) + "."
        context_used = True

    answer += "\n\nNote: this prototype uses synthetic operational data and should not be interpreted as private or classified station telemetry."

    return {
        "answer": answer,
        "category": category,
        "confidence": round(float(matches[0]["score"]), 3) if matches else (1.0 if context_used else 0.2),
        "information_type": info_type,
        "sources": sources,
        "context_used": context_used,
        "suggested_questions": suggested_questions(category),
    }


def facts_by_category(category: str | None = None) -> list[dict[str, str]]:
    if not category or category.lower() == "all":
        return FACTS
    return [f for f in FACTS if f["category"].lower() == category.lower()] or FACTS


def random_fact(category: str | None = None) -> dict[str, str]:
    pool = facts_by_category(category)
    idx = np.random.default_rng().integers(0, len(pool))
    return pool[int(idx)]
