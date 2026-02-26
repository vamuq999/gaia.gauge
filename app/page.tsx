"use client";

import { useEffect, useMemo, useState } from "react";
import { compute, co2PresetKgPerKwh, currencySymbol, defaultProfile, type Profile } from "../lib/gaiaCalc";

const STORAGE_KEY = "gaiagauge:v1:profile";

function safeNumber(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function Page() {
  const [profile, setProfile] = useState<Profile>(() => defaultProfile());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {}
  }, [profile, loaded]);

  const results = useMemo(() => compute(profile), [profile]);
  const sym = currencySymbol(profile.currency);

  function exportReport() {
    const payload = {
      app: "GaiaGauge",
      version: "v1",
      generatedAt: new Date().toISOString(),
      profile,
      results,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gaiagauge-report-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    const fresh = defaultProfile();
    setProfile(fresh);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  return (
    <main className="container">
      <section className="header">
        <div className="brand">
          <h1 className="h1">GaiaGauge</h1>
          <p className="sub">Measure energy. Reduce waste. Prove progress.</p>
        </div>
        <div className="badgeRow">
          <span className="badge">MVP: Energy Mirror</span>
          <span className="badge">Local-first</span>
          <span className="badge">No login needed</span>
        </div>
      </section>

      <section className="grid">
        {/* Inputs */}
        <div className="card">
          <div className="cardHeader">
            <p className="cardTitle">Inputs</p>
            <span className="badge">Autosaves</span>
          </div>
          <div className="cardBody">
            <div className="row">
              <div className="field">
                <div className="label">Household / Label</div>
                <input
                  className="input"
                  value={profile.householdName}
                  onChange={(e) => setProfile({ ...profile, householdName: e.target.value })}
                  placeholder="My Home"
                />
              </div>

              <div className="field">
                <div className="label">Currency</div>
                <select
                  className="select"
                  value={profile.currency}
                  onChange={(e) => setProfile({ ...profile, currency: e.target.value as Profile["currency"] })}
                >
                  <option value="AUD">AUD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="row">
              <div className="field">
                <div className="label">Region (for CO₂ default)</div>
                <select
                  className="select"
                  value={profile.region}
                  onChange={(e) => {
                    const region = e.target.value as Profile["region"];
                    setProfile({ ...profile, region, co2KgPerKwh: co2PresetKgPerKwh(region) });
                  }}
                >
                  <option value="AU-NSW">Australia — NSW</option>
                  <option value="AU-VIC">Australia — VIC</option>
                  <option value="AU-QLD">Australia — QLD</option>
                  <option value="AU-SA">Australia — SA</option>
                  <option value="AU-WA">Australia — WA</option>
                  <option value="AU-TAS">Australia — TAS</option>
                  <option value="AU-ACT">Australia — ACT</option>
                  <option value="AU-NT">Australia — NT</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="field">
                <div className="label">CO₂ factor (kg per kWh)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(profile.co2KgPerKwh)}
                  onChange={(e) => setProfile({ ...profile, co2KgPerKwh: safeNumber(e.target.value, profile.co2KgPerKwh) })}
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="row">
              <div className="field">
                <div className="label">Monthly usage (kWh)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(profile.monthlyKwh)}
                  onChange={(e) => setProfile({ ...profile, monthlyKwh: safeNumber(e.target.value, profile.monthlyKwh) })}
                />
              </div>

              <div className="field">
                <div className="label">Tariff (cents per kWh)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(profile.tariffCentsPerKwh)}
                  onChange={(e) =>
                    setProfile({ ...profile, tariffCentsPerKwh: safeNumber(e.target.value, profile.tariffCentsPerKwh) })
                  }
                />
              </div>
            </div>

            <div style={{ height: 10 }} />

            <div className="row">
              <div className="field">
                <div className="label">Usage you can shift off-peak (%)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(profile.peakShiftPct)}
                  onChange={(e) => setProfile({ ...profile, peakShiftPct: safeNumber(e.target.value, profile.peakShiftPct) })}
                />
              </div>

              <div className="field">
                <div className="label">Standby waste estimate (%)</div>
                <input
                  className="input"
                  inputMode="decimal"
                  value={String(profile.standbyWastePct)}
                  onChange={(e) =>
                    setProfile({ ...profile, standbyWastePct: safeNumber(e.target.value, profile.standbyWastePct) })
                  }
                />
              </div>
            </div>

            <div className="actions">
              <button className="btn btnPrimary" onClick={exportReport}>
                Export report (.json)
              </button>
              <button className="btn" onClick={() => setProfile({ ...profile, co2KgPerKwh: co2PresetKgPerKwh(profile.region) })}>
                Reset CO₂ to region default
              </button>
              <button className="btn btnDanger" onClick={reset}>
                Reset all
              </button>
            </div>

            <div className="footer">
              Tip: Start rough. Accuracy improves as you measure. Shipping beats perfection.
            </div>
          </div>
        </div>

        {/* Outputs */}
        <div className="card">
          <div className="cardHeader">
            <p className="cardTitle">Outputs</p>
            <span className="badge">{profile.householdName}</span>
          </div>
          <div className="cardBody">
            <div className="kpis">
              <div className="kpi">
                <div className="kpiTop">
                  <div className="kpiLabel">Monthly Cost</div>
                  <div className="pill">Est.</div>
                </div>
                <div className="kpiValue">
                  {sym}{Math.round(results.monthlyCost)}
                </div>
                <div className="kpiHint">Tariff × monthly kWh</div>
              </div>

              <div className="kpi">
                <div className="kpiTop">
                  <div className="kpiLabel">Monthly CO₂</div>
                  <div className="pill">Est.</div>
                </div>
                <div className="kpiValue">
                  {Math.round(results.monthlyCo2Kg)} kg
                </div>
                <div className="kpiHint">Factor × monthly kWh</div>
              </div>

              <div className="kpi">
                <div className="kpiTop">
                  <div className="kpiLabel">Yearly Cost</div>
                  <div className="pill">12×</div>
                </div>
                <div className="kpiValue">
                  {sym}{Math.round(results.yearlyCost)}
                </div>
                <div className="kpiHint">Projection</div>
              </div>

              <div className="kpi">
                <div className="kpiTop">
                  <div className="kpiLabel">Yearly CO₂</div>
                  <div className="pill">12×</div>
                </div>
                <div className="kpiValue">
                  {Math.round(results.yearlyCo2Kg)} kg
                </div>
                <div className="kpiHint">Projection</div>
              </div>
            </div>

            <div style={{ height: 12 }} />

            <div className="kpi">
              <div className="kpiTop">
                <div className="kpiLabel">Recoverable “Waste” (standby + peak efficiency)</div>
                <div className="pill">Target</div>
              </div>
              <div className="kpiValue">
                {Math.round(results.wasteKwh)} kWh/mo
              </div>
              <div className="kpiHint">
                ≈ {sym}{Math.round(results.wasteCost)}/mo · {Math.round(results.wasteCo2Kg)} kg CO₂/mo
              </div>
            </div>

            <div style={{ height: 12 }} />

            <p className="cardTitle" style={{ margin: 0 }}>Quick Wins</p>
            <div className="list">
              {results.quickWins.map((w, idx) => (
                <div className="item" key={idx}>
                  <div className="itemTop">
                    <p className="itemTitle">{w.title}</p>
                    <span className="pill">{w.priority}</span>
                  </div>
                  <div className="pill" style={{ marginTop: 8, display: "inline-block" }}>
                    {w.impactLabel}
                  </div>
                  <p className="itemDesc">{w.description}</p>
                </div>
              ))}
            </div>

            <div className="footer">
              Next phase: “Savings Proof” (bill-to-bill delta + badges).
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}