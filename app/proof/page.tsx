"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  currencySymbol,
  type Profile,
  type ProofEntry,
  type ProofScore,
  defaultProfile,
  defaultProofDraft,
  computeProof,
  computeScore,
} from "../../lib/gaiaCalc";

const PROFILE_KEY = "gaiagauge:v1:profile";
const PROOF_KEY = "gaiagauge:v1:proof";
const DRAFT_KEY = "gaiagauge:v1:proof:draft";

function safeNumber(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function ProofPage() {
  const [profile, setProfile] = useState<Profile>(() => defaultProfile());
  const [draft, setDraft] = useState<ProofEntry>(() => defaultProofDraft());
  const [history, setHistory] = useState<ProofEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Initial load: profile, draft, history + auto-tariff from profile
  useEffect(() => {
    // Load profile
    try {
      const p = localStorage.getItem(PROFILE_KEY);
      if (p) {
        const parsed = JSON.parse(p) as Profile;
        setProfile(parsed);

        // Auto-set tariff from profile on first load (nice UX)
        setDraft((d) => ({
          ...d,
          tariffCentsPerKwh: parsed.tariffCentsPerKwh ?? d.tariffCentsPerKwh,
        }));
      }
    } catch {}

    // Load draft
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) setDraft(JSON.parse(d) as ProofEntry);
    } catch {}

    // Load history
    try {
      const h = localStorage.getItem(PROOF_KEY);
      if (h) setHistory(JSON.parse(h) as ProofEntry[]);
    } catch {}

    setLoaded(true);
  }, []);

  // Autosave draft
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft, loaded]);

  // Autosave history
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(PROOF_KEY, JSON.stringify(history));
    } catch {}
  }, [history, loaded]);

  const sym = currencySymbol(profile.currency);

  const result = useMemo(() => computeProof(profile, draft), [profile, draft]);
  const score: ProofScore = useMemo(() => computeScore(profile, history), [profile, history]);

  function saveEntry() {
    const entry: ProofEntry = {
      ...draft,
      id: crypto.randomUUID?.() ?? String(Date.now()),
      createdAt: new Date().toISOString(),
    };

    setHistory([entry, ...history].slice(0, 50));

    // Reset draft but keep tariff sticky
    setDraft((d) => ({
      ...defaultProofDraft(),
      tariffCentsPerKwh: d.tariffCentsPerKwh,
    }));

    // Optional: if you want to clear the note too (default does it anyway)
    // setDraft((d) => ({ ...d, note: "" }));
  }

  function removeEntry(id: string) {
    setHistory(history.filter((x) => x.id !== id));
  }

  function clearAll() {
    setHistory([]);
    try {
      localStorage.removeItem(PROOF_KEY);
    } catch {}
  }

  return (
    <main className="container">
      <section className="header">
        <div className="brand">
          <h1 className="h1">Savings Proof</h1>
          <p className="sub">Bill-to-bill delta. Lead with money. Back it with kWh + CO₂.</p>
        </div>

        <div className="badgeRow">
          <span className="badge">Phase 2</span>
          <span className="badge">Local-first</span>
          <span className="badge">
            {score.badge} · Score {score.score}
          </span>
          <Link className="badge" href="/">
            ← Back to GaiaGauge
          </Link>
        </div>
      </section>

      <section className="grid">
        {/* Inputs */}
        <div className="card">
          <div className="cardHeader">
            <p className="cardTitle">Proof Inputs</p>
            <span className="badge">No upload needed</span>
          </div>

          <div className="cardBody">
            <div className="row">
              <div className="field">
                <div className="label">Previous bill usage (kWh)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(draft.prevKwh)}
                  onChange={(e) =>
                    setDraft({ ...draft, prevKwh: safeNumber(e.target.value, draft.prevKwh) })
                  }
                />
              </div>

              <div className="field">
                <div className="label">Current bill usage (kWh)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(draft.currKwh)}
                  onChange={(e) =>
                    setDraft({ ...draft, currKwh: safeNumber(e.target.value, draft.currKwh) })
                  }
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="row">
              <div className="field">
                <div className="label">Days between bills</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(draft.days)}
                  onChange={(e) => setDraft({ ...draft, days: safeNumber(e.target.value, draft.days) })}
                />
              </div>

              <div className="field">
                <div className="label">Tariff (cents per kWh)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(draft.tariffCentsPerKwh)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      tariffCentsPerKwh: safeNumber(e.target.value, draft.tariffCentsPerKwh),
                    })
                  }
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="row">
              <div className="field">
                <div className="label">Optional note</div>
                <input
                  className="input"
                  value={draft.note ?? ""}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder="e.g. cold-wash, off-peak, no dryer"
                />
              </div>

              <div className="field">
                <div className="label">CO₂ factor (kg per kWh)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(profile.co2KgPerKwh)}
                  disabled
                />
              </div>
            </div>

            <div className="actions">
              <button className="btn btnPrimary" onClick={saveEntry}>
                Save proof entry
              </button>
              <button className="btn btnDanger" onClick={clearAll}>
                Clear history
              </button>
            </div>

            <div className="footer">
              Lead with dollars. But keep the kWh honest. That’s how you win long-term.
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="card">
          <div className="cardHeader">
            <p className="cardTitle">Proof Output</p>
            <span className="badge">Money first</span>
          </div>

          <div className="cardBody">
            <div className="kpis">
              <div className="kpi">
                <div className="kpiTop">
                  <div className="kpiLabel">Estimated $ saved</div>
                  <div className="pill">Delta</div>
                </div>
                <div className="kpiValue">
                  {sym}
                  {Math.round(result.moneySaved)}
                </div>
                <div className="kpiHint">Normalized daily change × days</div>
              </div>

              <div className="kpi">
                <div className="kpiTop">
                  <div className="kpiLabel">kWh saved</div>
                  <div className="pill">Delta</div>
                </div>
                <div className="kpiValue">{Math.round(result.kwhSaved)} kWh</div>
                <div className="kpiHint">Prev/day − Curr/day (if positive)</div>
              </div>

              <div className="kpi">
                <div className="kpiTop">
                  <div className="kpiLabel">$ / day improvement</div>
                  <div className="pill">Rate</div>
                </div>
                <div className="kpiValue">
                  {sym}
                  {Math.round(result.moneyPerDay * 100) / 100}
                </div>
                <div className="kpiHint">Compoundable momentum</div>
              </div>

              <div className="kpi">
                <div className="kpiTop">
                  <div className="kpiLabel">CO₂ avoided</div>
                  <div className="pill">Impact</div>
                </div>
                <div className="kpiValue">{Math.round(result.co2AvoidedKg)} kg</div>
                <div className="kpiHint">kWh saved × CO₂ factor</div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="kpi">
              <div className="kpiTop">
                <div className="kpiLabel">Interpretation</div>
                <div className="pill">{result.label}</div>
              </div>
              <div className="kpiHint" style={{ marginTop: 6 }}>
                {result.explain}
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="kpi">
              <div className="kpiTop">
                <div className="kpiLabel">Proof Score</div>
                <div className="pill">{score.badge}</div>
              </div>

              <div className="kpiValue">{score.score}</div>

              <div className="kpiHint">
                {sym}
                {Math.round(score.totalSaved)} total saved · {Math.round(score.totalKwh)} kWh ·{" "}
                {Math.round(score.totalCo2)} kg CO₂ · {score.streak} entries · {sym}
                {Math.round(score.avgPerDay * 100) / 100}/day avg
              </div>
            </div>

            <div style={{ height: 12 }} />

            <p className="cardTitle" style={{ margin: 0 }}>
              History
            </p>
            <div className="list">
              {history.length === 0 && (
                <div className="item">
                  <p className="itemTitle">No entries yet</p>
                  <p className="itemDesc">
                    Save your first bill-to-bill comparison and build your proof trail.
                  </p>
                </div>
              )}

              {history.map((h) => {
                const r = computeProof(profile, h);
                return (
                  <div className="item" key={h.id}>
                    <div className="itemTop">
                      <p className="itemTitle">
                        {sym}
                        {Math.round(r.moneySaved)} saved
                      </p>
                      <span className="pill">{r.label}</span>
                    </div>

                    <p className="itemDesc">
                      {Math.round(r.kwhSaved)} kWh · {Math.round(r.co2AvoidedKg)} kg CO₂ · {sym}
                      {Math.round(r.moneyPerDay * 100) / 100}/day ·{" "}
                      {new Date(h.createdAt ?? "").toLocaleDateString()}
                      {h.note ? ` · “${h.note}”` : ""}
                    </p>

                    <div className="actions" style={{ marginTop: 8 }}>
                      <button className="btn btnDanger" onClick={() => removeEntry(h.id!)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="footer">
              Next: Proof Score → optional badge minting once you like the scoring.
            </div>
          </div>
        </div>
      </section>

      {/* Minimal footer */}
      <footer style={{ marginTop: 24, paddingTop: 16, opacity: 0.75, fontSize: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
          <span>© {new Date().getFullYear()} VoltaraLabs</span>
          <a href="mailto:VoltaraLabs@gmail.com">VoltaraLabs@gmail.com</a>
        </div>
      </footer>
    </main>
  );
}