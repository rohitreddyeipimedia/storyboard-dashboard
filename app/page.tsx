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
  const [generateSketches, setGenerateSketches] = useState(true);
  const [generationProgress, setGenerationProgress] = useState("");

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
    setGenerationProgress(generateSketches ? "Generating AI sketches... (this may take 2-3 minutes)" : "");
    
    try {
      if (!approved) throw new Error("Approve shotlist first.");

      const res = await apiPost("/api/generate-storyboard", {
        approved_shotlist: approved,
        metadata,
        sketch_style: "pencil sketch",
        generate_images: generateSketches,
      });

      const blob = await res.blob();
      const filename = generateSketches ? "Storyboard_With_AI_Sketches.pptx" : "Storyboard.pptx";

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
      setGenerationProgress("");
    }
  }

  const colors = {
    bg: "#0f172a",
    panel: "#1e293b",
    border: "#334155",
    text: "#f1f5f9",
    textMuted: "#94a3b8",
    textDark: "#cbd5e1",
    input: "#0f172a",
    primary: "#3b82f6",
    success: "#10b981",
    error: "#ef4444"
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24, background: colors.bg, minHeight: "100vh" }}>
      <header style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "flex-start", 
        marginBottom: 32,
        paddingBottom: 24,
        borderBottom: `1px solid ${colors.border}`,
        flexWrap: "wrap",
        gap: 16
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: colors.text }}>
            Storyboard Dashboard
          </h1>
          <p style={{ marginTop: 8, color: colors.textMuted, fontSize: 14 }}>
            Script → Shot Director → Approve → Storyboard PPTX
            {mode ? <span style={{ marginLeft: 8, padding: "4px 8px", background: colors.primary, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{mode}</span> : null}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {steps.map((s) => (
            <button
              key={s.id}
              onClick={() => (s.id === 1 ? setStep(1) : s.enabled ? setStep(s.id as any) : null)}
              disabled={s.id !== 1 && !s.enabled}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: step === s.id ? colors.primary : s.enabled ? colors.panel : "#1e293b",
                color: step === s.id || s.enabled ? colors.text : colors.textMuted,
                cursor: s.id === 1 || s.enabled ? "pointer" : "not-allowed",
                opacity: s.id === 1 || s.enabled ? 1 : 0.5,
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {s.id}) {s.label}
            </button>
          ))}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        <main style={{ 
          background: colors.panel, 
          border: `1px solid ${colors.border}`, 
          borderRadius: 12, 
          padding: 24,
          color: colors.text
        }}>
          {error ? (
            <div style={{ 
              background: "rgba(239, 68, 68, 0.1)", 
              border: `1px solid ${colors.error}`, 
              borderRadius: 8, 
              padding: 12, 
              marginBottom: 16,
              color: colors.error
            }}>
              {error}
            </div>
          ) : null}

          {step === 1 && (
            <>
              <h2 style={{ marginTop: 0, marginBottom: 16, color: colors.text }}>Upload / Paste Script</h2>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Paste your screenplay here..."
                rows={12}
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  background: colors.input,
                  color: colors.text,
                  fontSize: 14,
                  lineHeight: 1.6,
                  resize: "vertical",
                  fontFamily: "inherit"
                }}
              />
              <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                <button
                  onClick={generateShotlist}
                  disabled={busy}
                  style={{
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: colors.primary,
                    color: "white",
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.7 : 1,
                    fontSize: 14
                  }}
                >
                  {busy ? "Processing..." : "Generate Shotlist"}
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
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: colors.text,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Reset
                </button>
              </div>

              {structuredScript ? (
                <div style={{ marginTop: 16, padding: 12, background: colors.input, borderRadius: 8, color: colors.textMuted, fontSize: 13 }}>
                  Parsed scenes: {structuredScript.scenes?.length ?? 0}
                </div>
              ) : null}
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ marginTop: 0, marginBottom: 8, color: colors.text }}>Shotlist Review</h2>
              <p style={{ color: colors.textMuted, marginTop: 0, marginBottom: 16, fontSize: 14 }}>
                {shotlist?.shots?.length || 0} shots generated. Review and approve to generate storyboard.
              </p>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                <button
                  onClick={() => {
                    setApproved(shotlist);
                    setStep(3);
                  }}
                  disabled={busy || !shotlist}
                  style={{
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: colors.success,
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  ✓ Approve Shotlist
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
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: "transparent",
                    color: colors.text,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Download JSON
                </button>
              </div>

              <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${colors.border}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: colors.input }}>
                  <thead>
                    <tr style={{ background: colors.panel }}>
                      <th style={{ padding: 12, textAlign: "left", color: colors.text, borderBottom: `2px solid ${colors.border}`, fontWeight: 600 }}>Shot</th>
                      <th style={{ padding: 12, textAlign: "left", color: colors.text, borderBottom: `2px solid ${colors.border}`, fontWeight: 600 }}>Type</th>
                      <th style={{ padding: 12, textAlign: "left", color: colors.text, borderBottom: `2px solid ${colors.border}`, fontWeight: 600 }}>Action</th>
                      <th style={{ padding: 12, textAlign: "left", color: colors.text, borderBottom: `2px solid ${colors.border}`, fontWeight: 600 }}>Intent</th>
                      <th style={{ padding: 12, textAlign: "left", color: colors.text, borderBottom: `2px solid ${colors.border}`, fontWeight: 600 }}>Camera</th>
                      <th style={{ padding: 12, textAlign: "left", color: colors.text, borderBottom: `2px solid ${colors.border}`, fontWeight: 600 }}>Lens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(shotlist?.shots ?? []).map((s: any) => (
                      <tr key={s.shot_id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: 12, color: colors.primary, fontFamily: "monospace", fontWeight: 600 }}>
                          {s.shot_id}
                        </td>
                        <td style={{ padding: 12, color: colors.text }}>
                          <span style={{ 
                            padding: "2px 8px", 
                            background: colors.primary, 
                            borderRadius: 4, 
                            fontSize: 12,
                            fontWeight: 600 
                          }}>
                            {s.shot_type}
                          </span>
                        </td>
                        <td style={{ padding: 12, color: colors.textDark, maxWidth: 300 }}>{s.action}</td>
                        <td style={{ padding: 12, color: colors.textMuted }}>{s.intent}</td>
                        <td style={{ padding: 12, color: colors.textMuted, fontSize: 12 }}>
                          {s.camera?.movement}
                        </td>
                        <td style={{ padding: 12, color: colors.textMuted, fontSize: 12 }}>
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
              <h2 style={{ marginTop: 0, marginBottom: 8, color: colors.text }}>Storyboard Review</h2>
              <p style={{ color: colors.textMuted, marginTop: 0, marginBottom: 16, fontSize: 14 }}>
                Generate PowerPoint with {approved?.shots?.length || 0} slides.
              </p>

              {/* DALL-E TOGGLE */}
              <div style={{ marginBottom: 20, padding: 16, background: colors.input, borderRadius: 8, border: `1px solid ${colors.border}` }}>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={generateSketches}
                    onChange={(e) => setGenerateSketches(e.target.checked)}
                    style={{ width: 20, height: 20, accentColor: colors.primary }}
                  />
                  <div>
                    <div style={{ color: colors.text, fontWeight: 600, fontSize: 14 }}>
                      Generate AI Sketches with DALL-E 3
                    </div>
                    <div style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      Creates pencil sketch images for each shot (~4s per image)
                    </div>
                  </div>
                </label>
                
                {generateSketches && approved?.shots?.length > 0 && (
                  <div style={{ 
                    marginTop: 12, 
                    padding: 12, 
                    background: colors.panel, 
                    borderRadius: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span style={{ color: colors.textMuted, fontSize: 13 }}>
                      Estimated cost: ~${(approved.shots.length * 0.04).toFixed(2)} USD
                    </span>
                    <span style={{ color: colors.textMuted, fontSize: 13 }}>
                      Time: ~{Math.ceil(approved.shots.length * 5)} seconds
                    </span>
                  </div>
                )}
              </div>

              {generationProgress && (
                <div style={{ marginBottom: 16, padding: 12, background: "rgba(59, 130, 246, 0.1)", borderRadius: 8, color: colors.primary }}>
                  {generationProgress}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={downloadStoryboardPptx}
                  disabled={busy || !approved}
                  style={{
                    padding: "12px 24px",
                    borderRadius: 8,
                    border: "none",
                    background: colors.primary,
                    color: "white",
                    fontWeight: 600,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.7 : 1,
                    fontSize: 14
                  }}
                >
                  {busy ? (generateSketches ? "Generating Sketches..." : "Building PPTX...") : (generateSketches ? "Generate with AI Sketches" : "Download PPTX (Text Only)")}
                </button>
              </div>

              <div style={{ 
                marginTop: 24, 
                padding: 24, 
                background: colors.input, 
                borderRadius: 8,
                border: `1px dashed ${colors.border}`,
                textAlign: "center"
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
                <div style={{ color: colors.text, fontWeight: 600, marginBottom: 4 }}>
                  {approved?.shots?.length || 0} shots ready
                </div>
                <div style={{ color: colors.textMuted, fontSize: 13 }}>
                  {generateSketches 
                    ? "Each slide will include an AI-generated pencil sketch" 
                    : "Each slide will include shot description text"}
                </div>
              </div>
            </>
          )}
        </main>

        <aside style={{ 
          background: colors.panel, 
          border: `1px solid ${colors.border}`, 
          borderRadius: 12, 
          padding: 24,
          height: "fit-content"
        }}>
          <h3 style={{ marginTop: 0, marginBottom: 20, color: colors.text, fontSize: 18 }}>Project Settings</h3>

          <label style={{ display: "block", fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: 500 }}>
            Project Name
          </label>
          <input
            value={metadata.project_name}
            onChange={(e) => setMetadata((m) => ({ ...m, project_name: e.target.value }))}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: colors.input,
              color: colors.text,
              marginBottom: 16,
              fontSize: 14
            }}
          />

          <label style={{ display: "block", fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: 500 }}>
            Aspect Ratio
          </label>
          <select
            value={metadata.aspect_ratio}
            onChange={(e) => setMetadata((m) => ({ ...m, aspect_ratio: e.target.value as any }))}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: colors.input,
              color: colors.text,
              marginBottom: 16,
              fontSize: 14
            }}
          >
            <option value="16:9">16:9 Widescreen</option>
            <option value="9:16">9:16 Vertical</option>
            <option value="1:1">1:1 Square</option>
          </select>

          <label style={{ display: "block", fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: 500 }}>
            Genre
          </label>
          <input
            value={metadata.genre ?? ""}
            onChange={(e) => setMetadata((m) => ({ ...m, genre: e.target.value }))}
            placeholder="Drama, Action, Comedy..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: colors.input,
              color: colors.text,
              marginBottom: 16,
              fontSize: 14
            }}
          />

          <label style={{ display: "block", fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: 500 }}>
            Duration Target (sec)
          </label>
          <input
            type="number"
            value={metadata.duration_target_sec ?? 0}
            onChange={(e) => setMetadata((m) => ({ ...m, duration_target_sec: Number(e.target.value || 0) }))}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: colors.input,
              color: colors.text,
              marginBottom: 16,
              fontSize: 14
            }}
          />

          <label style={{ display: "block", fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: 500 }}>
            Visual Tone Keywords
          </label>
          <input
            value={metadata.visual_tone_keywords ?? ""}
            onChange={(e) => setMetadata((m) => ({ ...m, visual_tone_keywords: e.target.value }))}
            placeholder="Dark, gritty, neon..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: colors.input,
              color: colors.text,
              marginBottom: 16,
              fontSize: 14
            }}
          />

          <label style={{ display: "block", fontSize: 13, color: colors.textMuted, marginBottom: 6, fontWeight: 500 }}>
            Notes for Shot Director
          </label>
          <textarea
            rows={4}
            value={metadata.director_notes ?? ""}
            onChange={(e) => setMetadata((m) => ({ ...m, director_notes: e.target.value }))}
            placeholder="Specific instructions..."
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: colors.input,
              color: colors.text,
              marginBottom: 16,
              fontSize: 14,
              resize: "vertical"
            }}
          />

          <div style={{ marginTop: 20, padding: 12, background: colors.input, borderRadius: 6, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: colors.textMuted }}>Mode:</span>
              <span style={{ color: colors.text, fontWeight: 600 }}>{mode ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: colors.textMuted }}>AI Enabled:</span>
              <span style={{ color: mode === "kimi" ? colors.success : colors.textMuted, fontWeight: 600 }}>
                {mode === "kimi" ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
