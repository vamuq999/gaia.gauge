"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  currencySymbol,
  type Profile,
  type ProofEntry,
  defaultProfile,
  defaultProofDraft,
  computeProof,
} from "../../lib/gaiaCalc";

const PROFILE_KEY = "gaiagauge:v1:profile";
const PROOF_KEY = "gaiagauge:v1:proof";

function safeNumber(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function ProofPage() {
  const [profile, setProfile] = useState<Profile>(() => defaultProfile());
  const [draft, setDraft] = useState<ProofEntry>(() => defaultProofDraft());
  const [history, setHistory] = useState<ProofEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load profile
    let loadedProfile: Profile | null = null;
    try {
      const p = localStorage.getItem(PROFILE_KEY);
      if (p) {
        loadedProfile = JSON.parse(p);
        setProfile(loadedProfile);
      }
    } catch {}

    // Load history
    try {
      const h = localStorage.getItem(PROOF_KEY);
      if (h) setHistory(JSON.parse(h));
    } catch {}

    // ✅ Upgrade: auto-set draft tariff from profile if available
    setDraft((d) => ({
      ...d,
      tariffCentsPerKwh: loadedProfile?.tariffCentsPerKwh ?? d.tariffCentsPerKwh,
    }));

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(PROOF_KEY, JSON.stringify(history));
    } catch {}
  }, [history, loaded]);

  const sym = currencySymbol(profile.currency);
  const result = useMemo(() => computeProof(profile, draft), [profile, draft]);

  function saveEntry() {
    const entry: ProofEntry = {
      ...draft,
      id: crypto.randomUUID?.() ?? String(Date.now()),
      createdAt: new Date().toISOString(),
    };
    setHistory([entry, ...history].slice(0, 50));
    setDraft((d) => ({
      ...defaultProofDraft(),
      tariffCentsPerKwh: d.tariffCentsPerKwh, // keep tariff sticky
    }));
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
                  onChange={(e) => setDraft({ ...draft, prevKwh: safeNumber(e.target.value, draft.prevKwh) })}
                />
              </div>

              <div className="field">
                <div className="label">Current bill usage (kWh)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(draft.currKwh)}
                  onChange={(e) => setDraft({ ...draft, currKwh: safeNumber(e.target.value, draft.currKwh) })}
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
                    setDraft({ ...draft, tariffCentsPerKwh: safeNumber(e.target.value, draft.tariffCentsPerKwh) })
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
                  placeholder="e.g. stopped dryer use, cold-wash, off-peak"
                />
              </div>

              <div className="field">
                <div className="label">CO₂ factor (kg per kWh)</div>
                <input className="input" inputMode="decimal" value={String(profile.co2KgPerKwh)} disabled />
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
              Pro tip: if your bill is in dollars only, estimate kWh from your tariff.
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
                  {sym}{Math.round(result.moneySaved)}
                </div>
                <div className="kpiHint">Normalized daily kWh change × days</div>
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
                  {sym}{Math.round(result.moneyPerDay * 100) / 100}
                </div>
                <div className="kpiHint">Momentum you can compound</div>
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

            <p className="cardTitle" style={{ margin: 0 }}>History</p>
            <div className="list">
              {history.length === 0 && (
                <div className="item">
                  <p className="itemTitle">No entries yet</p>
                  <p className="itemDesc">Save your first bill-to-bill comparison and you’ll build a proof trail.</p>
                </div>
              )}

              {history.map((h) => {
                const r = computeProof(profile, h);
                return (
                  <div className="item" key={h.id}>
                    <div className="itemTop">
                      <p className="itemTitle">
                        {sym}{Math.round(r.moneySaved)} saved
                      </p>
                      <span className="pill">{r.label}</span>
                    </div>
                    <p className="itemDesc">
                      {Math.round(r.kwhSaved)} kWh · {Math.round(r.co2AvoidedKg)} kg CO₂ ·{" "}
                      {sym}{Math.round(r.moneyPerDay * 100) / 100}/day ·{" "}
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

            <div className="footer">Next: badge minting (optional) once you like the scoring.</div>
          </div>
        </div>
      </section>
    </main>
  );
}