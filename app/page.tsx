"use client";

import { useMemo, useState } from "react";

type Metadata = {
  project_name: string;
  aspect_ratio: "16:9" | "9:16" | "1:1";
  genre?: string;
  duration_target_sec?: number;
  visual_tone_keywords?: string;
  director_notes?: string;
};

export default function Home() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [scriptText, setScriptText] = useState("");
  const [metadata, setMetadata] = useState<Metadata>({
    project_name: "Untitled Project",
    aspect_ratio: "16:9",
    genre: "",
    duration_target_sec: 0,
    visual_tone_keywords: "",
    director_notes: "",
  });

  const [structuredScript, setStructuredScript] = useState<any>(null);
  const [shotlist, setShotlist] = useState<any>(null);
  const [approved, setApproved] = useState<any>(null);
  const [mode, setMode] = useState<"mock" | "kimi" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGoShotlist = Boolean(shotlist);
  const canGoStoryboard = Boolean(approved);

  const steps = useMemo(
    () => [
      { id: 1, label: "Upload" },
      { id: 2, label: "Shotlist Review", enabled: canGoShotlist },
      { id: 3, label: "Storyboard Review", enabled: canGoStoryboard },
    ],
    [canGoShotlist, canGoStoryboard]
  );

  async function apiPost(path: string, body: any) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res;
  }

  async function generateShotlist() {
    setError(null);
    setBusy(true);
    try {
      if (!scriptText.trim()) throw new Error("Paste a script first.");

      const parseRes = await apiPost("/api/parse-script", {
        raw_script_text: scriptText,
        metadata,
      });
      const parseJson = await parseRes.json();
      setStructuredScript(parseJson.structured_script);

      const shotRes = await apiPost("/api/generate-shotlist", {
        structured_script: parseJson.structured_script,
        metadata,
      });
      const shotJson = await shotRes.json();
      setMode(shotJson.mode);
      setShotlist(shotJson.shotlist);
      setApproved(null);
      setStep(2);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadStoryboardPptx() {
    setError(null);
    setBusy(true);
    try {
      if (!approved) throw new Error("Approve shotlist first.");

      const res = await apiPost("/api/generate-storyboard", {
        approved_shotlist: approved,
        metadata,
        sketch_style: "pencil",
      });

      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const filename =
        /filename="([^"]+)"/.exec(cd)?.[1] || "Storyboard.pptx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Storyboard Dashboard</h1>
          <p style={{ marginTop: 6, opacity: 0.75 }}>
            Script → Shot Director → Approve → Storyboard PPTX{" "}
            {mode ? <strong>({mode})</strong> : null}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {steps.map((s) => (
            <button
              key={s.id}
              onClick={() => (s.id === 1 ? setStep(1) : s.enabled ? setStep(s.id as any) : null)}
              disabled={s.id !== 1 && !s.enabled}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #2a2f3a",
                background: step === s.id ? "#1b2435" : "#121722",
                color: "white",
                cursor: s.id === 1 || s.enabled ? "pointer" : "not-allowed",
                opacity: s.id === 1 || s.enabled ? 1 : 0.5,
                fontWeight: 650,
              }}
            >
              {s.id}) {s.label}
            </button>
          ))}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1.25fr .75fr", gap: 12, marginTop: 12 }}>
        <main style={{ background: "#0f1420", border: "1px solid #222a38", borderRadius: 16, padding: 14 }}>
          {error ? (
            <div style={{ background: "#2a1212", border: "1px solid #5a1c1c", borderRadius: 12, padding: 10, marginBottom: 10 }}>
              {error}
            </div>
          ) : null}

          {step === 1 && (
            <>
              <h2 style={{ marginTop: 0 }}>Upload / Paste Script</h2>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Paste script here..."
                rows={14}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #2a2f3a",
                  background: "#0b1020",
                  color: "white",
                }}
              />
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  onClick={generateShotlist}
                  disabled={busy}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #3b82f6",
                    background: "#1d3b73",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {busy ? "Working..." : "Generate Shotlist"}
                </button>
                <button
                  onClick={() => {
                    setScriptText("");
                    setStructuredScript(null);
                    setShotlist(null);
                    setApproved(null);
                    setMode(null);
                    setStep(1);
                    setError(null);
                  }}
                  disabled={busy}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #2a2f3a",
                    background: "#121722",
                    color: "white",
                    fontWeight: 650,
                  }}
                >
                  Reset
                </button>
              </div>

              {structuredScript ? (
                <pre style={{ marginTop: 12, fontSize: 12, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                  Parsed scenes: {structuredScript.scenes?.length ?? 0}
                </pre>
              ) : null}
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ marginTop: 0 }}>Shotlist Review</h2>
              <p style={{ opacity: 0.75, marginTop: 6 }}>
                Review and approve. (Change requests can be wired into revision_notes later.)
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                <button
                  onClick={() => {
                    setApproved(shotlist);
                    setStep(3);
                  }}
                  disabled={busy || !shotlist}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #22c55e",
                    background: "#124026",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  Approve Shotlist
                </button>

                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(shotlist, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "shotlist.json";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  }}
                  disabled={!shotlist}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #2a2f3a",
                    background: "#121722",
                    color: "white",
                    fontWeight: 650,
                  }}
                >
                  Download shotlist.json
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ textAlign: "left", opacity: 0.8 }}>
                      <th style={{ padding: 8, borderBottom: "1px solid #2a2f3a" }}>Shot</th>
                      <th style={{ padding: 8, borderBottom: "1px solid #2a2f3a" }}>Type</th>
                      <th style={{ padding: 8, borderBottom: "1px solid #2a2f3a" }}>Action</th>
                      <th style={{ padding: 8, borderBottom: "1px solid #2a2f3a" }}>Intent</th>
                      <th style={{ padding: 8, borderBottom: "1px solid #2a2f3a" }}>Move</th>
                      <th style={{ padding: 8, borderBottom: "1px solid #2a2f3a" }}>Lens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(shotlist?.shots ?? []).map((s: any) => (
                      <tr key={s.shot_id}>
                        <td style={{ padding: 8, borderBottom: "1px solid #1f2533", fontFamily: "ui-monospace" }}>
                          {s.shot_id}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #1f2533" }}>{s.shot_type}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #1f2533" }}>{s.action}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #1f2533", opacity: 0.85 }}>{s.intent}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid #1f2533", opacity: 0.85 }}>
                          {s.camera?.movement}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #1f2533", opacity: 0.85 }}>
                          {s.lens?.mm_range}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 style={{ marginTop: 0 }}>Storyboard Review</h2>
              <p style={{ opacity: 0.75, marginTop: 6 }}>
                Generates a PPTX (1 slide per shot). In KIMI mode, you can return sketch_image_url per shot.
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={downloadStoryboardPptx}
                  disabled={busy || !approved}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid #3b82f6",
                    background: "#1d3b73",
                    color: "white",
                    fontWeight: 700,
                  }}
                >
                  {busy ? "Building..." : "Download Storyboard PPTX"}
                </button>
              </div>

              <div style={{ marginTop: 12, opacity: 0.8, fontSize: 12 }}>
                Slides: {approved?.shots?.length ?? 0}
              </div>
            </>
          )}
        </main>

        <aside style={{ background: "#0f1420", border: "1px solid #222a38", borderRadius: 16, padding: 14 }}>
          <h3 style={{ marginTop: 0 }}>Project Settings</h3>

          <label style={{ fontSize: 12, opacity: 0.8 }}>Project Name</label>
          <input
            value={metadata.project_name}
            onChange={(e) => setMetadata((m) => ({ ...m, project_name: e.target.value }))}
            style={inputStyle}
          />

          <label style={{ fontSize: 12, opacity: 0.8, marginTop: 10, display: "block" }}>Aspect Ratio</label>
          <select
            value={metadata.aspect_ratio}
            onChange={(e) => setMetadata((m) => ({ ...m, aspect_ratio: e.target.value as any }))}
            style={inputStyle}
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
          </select>

          <label style={{ fontSize: 12, opacity: 0.8, marginTop: 10, display: "block" }}>Genre</label>
          <input
            value={metadata.genre ?? ""}
            onChange={(e) => setMetadata((m) => ({ ...m, genre: e.target.value }))}
            style={inputStyle}
          />

          <label style={{ fontSize: 12, opacity: 0.8, marginTop: 10, display: "block" }}>Duration Target (sec)</label>
          <input
            type="number"
            value={metadata.duration_target_sec ?? 0}
            onChange={(e) => setMetadata((m) => ({ ...m, duration_target_sec: Number(e.target.value || 0) }))}
            style={inputStyle}
          />

          <label style={{ fontSize: 12, opacity: 0.8, marginTop: 10, display: "block" }}>
            Visual Tone Keywords
          </label>
          <input
            value={metadata.visual_tone_keywords ?? ""}
            onChange={(e) => setMetadata((m) => ({ ...m, visual_tone_keywords: e.target.value }))}
            style={inputStyle}
          />

          <label style={{ fontSize: 12, opacity: 0.8, marginTop: 10, display: "block" }}>
            Notes for Shot Director
          </label>
          <textarea
            rows={5}
            value={metadata.director_notes ?? ""}
            onChange={(e) => setMetadata((m) => ({ ...m, director_notes: e.target.value }))}
            style={{ ...inputStyle, resize: "vertical" as const }}
          />

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            Mode: <strong>{mode ?? "—"}</strong>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            KIMI enabled: <strong>{mode === "kimi" ? "Yes" : "No / Unknown"}</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 12,
  border: "1px solid #2a2f3a",
  background: "#0b1020",
  color: "white",
  marginTop: 6,
};
