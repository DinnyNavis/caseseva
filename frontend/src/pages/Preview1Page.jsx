import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addFact, approvePreview1, editFact, editParties, editTimeline, getPreview1, rerunPreview1, uploadEvidence
} from "../api";
import { ArrowUpRight, ArrowLeft, AlertCircle, FileText, Check, Upload } from "lucide-react";

export default function Preview1Page() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [newFact, setNewFact] = useState("");
  const [saved, setSaved] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => getPreview1(caseId).then(setData);

  useEffect(() => {
    load();
  }, [caseId]);

  if (!data) {
    return (
      <main className="main-container content-narrow" style={{ textAlign: "center", paddingTop: "5rem" }}>
        <span className="eyebrow-label">INITIALIZING</span>
        <p style={{ color: "var(--text-body)", fontSize: "1.05rem" }}>Loading Preview 1 factual audit…</p>
      </main>
    );
  }

  const save = async (action) => {
    setBusy(true);
    try {
      await action();
      setSaved("Changes saved to case record.");
      await load();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (window.confirm("Confirm that you have reviewed the facts, timeline, and parties?")) {
      await approvePreview1(caseId);
      navigate(`/cases/${caseId}`);
    }
  };

  const upload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadError("");
    setBusy(true);
    try {
      await uploadEvidence(caseId, file);
      await rerunPreview1(caseId);
      setSaved("Evidence uploaded; fact and timeline extraction rerunning.");
      await new Promise((resolve) => setTimeout(resolve, 500));
      await load();
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setBusy(false);
    }
    event.target.value = "";
  };

  return (
    <main className="main-container content-narrow" style={{ paddingBottom: "6rem" }}>
      {/* Editorial Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <span className="eyebrow-label">FACTUAL AUDIT PROTOCOL</span>
        <div className="hairline-gold" />

        <div className="stacked-headline" style={{ marginBottom: "1rem" }}>
          <h1 className="headline-secondary" style={{ margin: 0 }}>
            PREVIEW 1
          </h1>
          <span className="headline-connective">CONFIRM WHAT</span>
          <span className="headline-dominant" style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)" }}>
            WE UNDERSTOOD.
          </span>
        </div>

        <p style={{ fontSize: "1.05rem", color: "var(--text-body)", lineHeight: 1.6, maxWidth: "56ch" }}>
          Please audit what our pipeline extracted before statutory provisions are mapped. Every fact is paired directly beside the evidence that substantiates it.
        </p>

        {saved && (
          <p role="status" style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#000000", fontWeight: 700 }}>
            ✓ {saved}
          </p>
        )}
      </div>

      <hr className="hairline-rule" style={{ margin: "1.5rem 0 2.5rem" }} />

      {/* SECTION 1: EXTRACTED FACTS PAIRED BESIDE SUPPORTING EVIDENCE */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.5rem" }}>
          <div>
            <span className="eyebrow-label">MATERIAL STATEMENTS</span>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
              Extracted Facts &amp; Supporting Evidence
            </h2>
          </div>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Edit inline · Blur to save
          </span>
        </div>

        <div style={{ borderTop: "1px solid var(--border-hairline)" }}>
          {data.facts.map((fact) => (
            <article
              key={fact.fact_id}
              data-testid="fact-card"
              style={{
                padding: "1.75rem 0",
                borderBottom: "1px solid var(--border-hairline)",
                display: "grid",
                gridTemplateColumns: "auto 1fr minmax(180px, 260px) auto",
                gap: "1.5rem",
                alignItems: "start",
              }}
            >
              {/* Fact ID badge */}
              <span className="status-pill status-pill--grey" style={{ fontWeight: 800, marginTop: "0.4rem" }}>
                {fact.fact_id}
              </span>

              {/* Fact text (inline editable) */}
              <div>
                <input
                  aria-label={`Fact ${fact.fact_id}`}
                  value={fact.text}
                  onChange={(e) =>
                    setData({
                      ...data,
                      facts: data.facts.map((f) => (f.fact_id === fact.fact_id ? { ...f, text: e.target.value } : f)),
                    })
                  }
                  onBlur={(e) => save(() => editFact(caseId, fact.fact_id, { text: e.target.value }))}
                  style={{
                    fontSize: "1rem",
                    fontWeight: 500,
                    lineHeight: 1.6,
                    color: "#000000",
                    border: "1px solid transparent",
                    background: "transparent",
                    padding: "0.25rem 0.4rem",
                    borderRadius: "var(--radius-sm)",
                    width: "100%",
                  }}
                  onFocus={(e) => {
                    e.target.style.background = "#FFFFFF";
                    e.target.style.borderColor = "var(--border-subtle)";
                  }}
                />
              </div>

              {/* Visual Evidence Pairing: Fact sits BESIDE evidence proving it */}
              <div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-eyebrow)", textTransform: "uppercase" }}>
                    EVIDENCE PROOF
                  </span>
                  {fact.evidence.length === 0 ? (
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                      Unsubstantiated in files
                    </span>
                  ) : (
                    fact.evidence.map((e) => (
                      <span key={e.evidence_id} className="evidence-chip">
                        <FileText size={13} color="#000000" />
                        <span>{e.filename}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Remove Action */}
              <button
                type="button"
                className="btn-text-link"
                style={{ color: "var(--status-crimson)", fontSize: "0.82rem", marginTop: "0.4rem" }}
                onClick={() => save(() => editFact(caseId, fact.fact_id, { removed: true }))}
              >
                Remove
              </button>
            </article>
          ))}
        </div>

        {/* Add Fact Missed */}
        <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            aria-label="Add a fact we missed"
            placeholder="Type a key fact that was omitted during automated extraction…"
            value={newFact}
            onChange={(e) => setNewFact(e.target.value)}
            style={{ flex: 1, minWidth: "280px" }}
          />
          <button
            type="button"
            className="btn-pill-secondary"
            onClick={() =>
              save(async () => {
                if (newFact.trim()) {
                  await addFact(caseId, { text: newFact });
                  setNewFact("");
                }
              })
            }
          >
            <span>Add a fact we missed</span>
          </button>
        </div>
      </section>

      {/* SECTION 2: CASE TIMELINE (Vertical rhythm) */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ marginBottom: "1.75rem" }}>
          <span className="eyebrow-label">CHRONOLOGY</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
            Case Timeline
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--text-body)" }}>
            Sequence of verifiable events leading up to this dispute.
          </p>
        </div>

        <div className="timeline-track">
          {data.timeline.map((event) => {
            const isUncertain = event.uncertain || (event.date && (event.date.includes("?") || event.date.toLowerCase().includes("approx") || event.date.toLowerCase().includes("est")));

            return (
              <article key={event.event_id} data-testid="timeline-event" className="timeline-item">
                <div className="timeline-marker" />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span className="status-pill status-pill--grey" style={{ fontWeight: 800 }}>
                      {event.event_id}
                    </span>
                    <input
                      aria-label={`Date ${event.event_id}`}
                      value={event.date}
                      onChange={(e) =>
                        setData({
                          ...data,
                          timeline: data.timeline.map((t) => (t.event_id === event.event_id ? { ...t, date: e.target.value } : t)),
                        })
                      }
                      onBlur={(e) => save(() => editTimeline(caseId, event.event_id, { date: e.target.value }))}
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        color: "#000000",
                        width: "160px",
                        padding: "0.2rem 0.5rem",
                      }}
                    />
                  </div>

                  {isUncertain && (
                    <span className="status-pill status-pill--crimson" style={{ fontSize: "0.72rem" }}>
                      ⚠️ Date Uncertain
                    </span>
                  )}
                </div>

                <p style={{ fontSize: "0.95rem", color: "var(--text-body)", lineHeight: 1.6, paddingLeft: "0.5rem" }}>
                  {event.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: IDENTIFIED PARTIES */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">LEGAL CAPACITY</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
            Identified Parties
          </h2>
        </div>

        {data.parties && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div>
              <label>
                Client Role
                <input
                  aria-label="Client role"
                  value={data.parties.client_role || ""}
                  onChange={(e) => setData({ ...data, parties: { ...data.parties, client_role: e.target.value } })}
                  onBlur={() => save(() => editParties(caseId, data.parties))}
                />
              </label>
            </div>
            <div>
              <label>
                Opposite Party
                <input
                  aria-label="Opposite party"
                  value={data.parties.opposite_party || ""}
                  onChange={(e) => setData({ ...data, parties: { ...data.parties, opposite_party: e.target.value } })}
                  onBlur={() => save(() => editParties(caseId, data.parties))}
                />
              </label>
            </div>
            <div>
              <label>
                Relationship
                <input
                  aria-label="Relationship"
                  value={data.parties.relationship || ""}
                  onChange={(e) => setData({ ...data, parties: { ...data.parties, relationship: e.target.value } })}
                  onBlur={() => save(() => editParties(caseId, data.parties))}
                />
              </label>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4: SUPPLEMENTAL EVIDENCE UPLOAD */}
      <section style={{ marginBottom: "3.5rem", padding: "2rem 0", borderTop: "1px solid var(--border-hairline)", borderBottom: "1px solid var(--border-hairline)" }}>
        <span className="eyebrow-label">ADDITIONAL DOCUMENTATION</span>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#000000", marginBottom: "0.5rem" }}>
          Upload Additional Evidence
        </h3>
        <p style={{ fontSize: "0.95rem", color: "var(--text-body)", marginBottom: "1.25rem" }}>
          Uploading new evidence triggers a targeted rerun of the fact and timeline extraction pipeline.
        </p>

        <input type="file" onChange={upload} disabled={busy} style={{ width: "auto" }} />
        {uploadError && (
          <div role="alert" style={{ marginTop: "1rem" }}>
            <span>{uploadError}</span>
          </div>
        )}
      </section>

      {/* APPROVAL FOOTER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1rem" }}>
        <button type="button" className="btn-text-link" onClick={() => navigate(`/cases/${caseId}`)}>
          <ArrowLeft size={15} />
          <span>Back to case file</span>
        </button>
        <button type="button" className="btn-pill-primary" onClick={approve}>
          <span>Approve and continue</span>
          <ArrowUpRight size={16} />
        </button>
      </div>
    </main>
  );
}
