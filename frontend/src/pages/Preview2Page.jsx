import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  approvePreview2, correctPreview2Fact, getPreview2, resolveDocumentRequest
} from "../api";
import { ArrowUpRight, ArrowLeft, Check, AlertCircle, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

export default function Preview2Page() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejectedOpen, setRejectedOpen] = useState(true);

  const load = () => getPreview2(caseId).then(setData);

  useEffect(() => {
    load();
  }, [caseId]);

  if (!data) {
    return (
      <main className="main-container content-narrow" style={{ textAlign: "center", paddingTop: "5rem" }}>
        <span className="eyebrow-label">INITIALIZING</span>
        <p style={{ color: "var(--text-body)", fontSize: "1.05rem" }}>Loading statutory analysis &amp; defense matrix…</p>
      </main>
    );
  }

  const saveFact = async (factId, text) => {
    setBusy(true);
    try {
      await correctPreview2Fact(caseId, factId, text);
      setMessage("Fact updated; affected statutory retrievals re-evaluated.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadRequest = async (requestId, event) => {
    const file = event.target.files[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await resolveDocumentRequest(caseId, requestId, file);
      setMessage("Document received; dependent legal issues re-evaluated.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
    event.target.value = "";
  };

  const approve = async () => {
    const outstanding = data.document_requests?.filter((item) => !item.resolved) || [];
    const waive = outstanding.length > 0 && window.confirm("Proceed to advocate review without the requested supporting document?");
    if (outstanding.length > 0 && !waive) return;
    setBusy(true);
    try {
      await approvePreview2(caseId, waive);
      navigate(`/cases/${caseId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="main-container content-narrow" style={{ paddingBottom: "7rem" }}>
      {/* Editorial Header — Gold used EXACTLY ONCE on the headline line */}
      <div style={{ marginBottom: "2.5rem" }}>
        <span className="eyebrow-label">STATUTORY AUDIT &amp; DEFENSE CHALLENGE</span>
        <div className="hairline-gold" />

        <div className="stacked-headline" style={{ marginBottom: "1rem" }}>
          <h1 className="headline-secondary" style={{ margin: 0 }}>
            PREVIEW 2
          </h1>
          <span className="headline-connective">VERIFIED</span>
          <span className="headline-gold">LEGAL ANALYSIS.</span>
        </div>

        <p style={{ fontSize: "1.05rem", color: "var(--text-body)", lineHeight: 1.6, maxWidth: "58ch" }}>
          Every cited provision has been matched and verified against official gazetted text. Unsupported citations are trapped and rejected.
        </p>

        {message && (
          <p role="status" style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#000000", fontWeight: 700 }}>
            ✓ {message}
          </p>
        )}
        {error && (
          <div role="alert" style={{ marginTop: "1rem" }}>
            <span>{error}</span>
          </div>
        )}
      </div>

      <hr className="hairline-rule" style={{ margin: "1.5rem 0 2.5rem" }} />

      {/* SECTION 1: DETECTED CASE DOMAIN */}
      <section data-testid="preview2-domain" style={{ marginBottom: "3rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <span className="eyebrow-label">STATUTORY JURISDICTION</span>
          <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#000000" }}>
            {data.domain?.domain} &mdash; {data.domain?.sub_domain}
          </span>
        </div>
        <p style={{ fontSize: "0.98rem", lineHeight: 1.65, color: "var(--text-body)" }}>
          {data.domain?.reasoning}
        </p>
      </section>

      {/* Unsupported Domain Alert */}
      {data.forum?.forum_family === "UNSUPPORTED_DOMAIN" && (
        <div role="alert" style={{ marginBottom: "3rem", background: "#FAFAFA", borderLeft: "3px solid #000000", padding: "1.25rem 1.5rem" }}>
          <div>
            <strong style={{ display: "block", marginBottom: "0.25rem", color: "#000000" }}>
              Automated Coverage Scope Notice
            </strong>
            <p style={{ fontSize: "0.92rem", lineHeight: 1.6, color: "var(--text-body)" }}>
              Automated statutory retrieval for '{data.domain?.domain}' is currently outside our gazette coverage. Your factual record and timeline are preserved above.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 2: VERIFIED STATUTORY PROVISIONS */}
      {/* GOLD DENSITY DISCIPLINE: Verified is default — no gold pills here! Restrained black/hairline typography */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">STATUTORY APPLICABILITY</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
            The Law That Applies ({data.verified_provisions.length})
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--text-body)" }}>
            Provisions grounded directly in official indiacode.nic.in statutory text.
          </p>
        </div>

        <div style={{ borderTop: "1px solid var(--border-hairline)" }}>
          {data.verified_provisions.map((item) => (
            <article
              key={item.provision_id}
              data-testid="verified-provision"
              style={{
                padding: "1.75rem 0",
                borderBottom: "1px solid var(--border-hairline)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#000000", letterSpacing: "0.03em" }}>
                    {item.provision_id}
                  </span>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#000000" }}>
                    {item.title}
                  </h3>
                </div>

                {item.source_url && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-text-link"
                    style={{ fontSize: "0.85rem" }}
                  >
                    <span>Official Act text</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>

              <p style={{ fontSize: "0.96rem", lineHeight: 1.65, color: "var(--text-body)", maxWidth: "75ch" }}>
                {item.explanation}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* SECTION 3: REJECTED CITATIONS (The exception state that deserves color — Muted Crimson) */}
      {data.rejected_provisions?.length > 0 && (
        <section style={{ marginBottom: "3.5rem" }}>
          <div
            onClick={() => setRejectedOpen(!rejectedOpen)}
            style={{
              cursor: "pointer",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1rem 0",
              borderTop: "1px solid var(--border-hairline)",
              borderBottom: "1px solid var(--border-hairline)",
              userSelect: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="status-pill status-pill--crimson" style={{ fontSize: "0.72rem" }}>
                {data.rejected_provisions.length} TRAPPED
              </span>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#000000", margin: 0 }}>
                Rejected Provisions &amp; Hallucination Filter
              </h2>
            </div>
            {rejectedOpen ? <ChevronDown size={18} color="#000000" /> : <ChevronRight size={18} color="#000000" />}
          </div>

          {rejectedOpen && (
            <div style={{ marginTop: "1rem" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-body)", marginBottom: "1.5rem" }}>
                The following provisions were evaluated and deliberately excluded because they lack factual grounding in the case record.
              </p>

              {data.rejected_provisions.map((item) => {
                const reason = (data.citation_verification?.decisions || []).find((d) => d.provision_id === item.provision_id)?.reason;

                return (
                  <article
                    key={item.provision_id}
                    data-testid="rejected-provision"
                    style={{
                      padding: "1.25rem 0",
                      borderBottom: "1px solid var(--border-hairline)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.35rem" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--status-crimson)" }}>
                        {item.provision_id}
                      </span>
                      <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#000000" }}>
                        {item.title}
                      </h3>
                    </div>
                    <p style={{ fontSize: "0.92rem", color: "var(--text-body)", lineHeight: 1.6, marginBottom: "0.4rem" }}>
                      {item.explanation}
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "var(--status-crimson)", fontWeight: 600 }}>
                      Rejection rationale: {reason || "Fails statutory predicate tests."}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SECTION 4: OPPONENT OBJECTIONS PAIRED WITH REBUTTALS (Side-by-Side) */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">DEFENSE ANTICIPATION</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
            Anticipated Objections &amp; Grounded Counter-Rebuttals
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--text-body)" }}>
            How an opposing advocate or respondent may challenge this complaint, paired directly with counter-arguments.
          </p>
        </div>

        <div style={{ borderTop: "1px solid var(--border-hairline)" }}>
          {(data.arguments?.opponent?.objections || []).map((objection) => {
            const rebuttal = (data.arguments?.rebuttal?.rebuttals || []).find(
              (item) => item.objection_id === objection.objection_id
            );
            const isResolved = rebuttal?.resolution === "RESOLVED";

            return (
              <div key={objection.objection_id} className="objection-rebuttal-grid">
                {/* Left Column: Anticipated Objection */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span className="eyebrow-label" style={{ marginBottom: 0 }}>
                      OPPONENT OBJECTION · {objection.objection_id}
                    </span>
                  </div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#000000", lineHeight: 1.5 }}>
                    {objection.text}
                  </h3>
                </div>

                {/* Right Column: Rebuttal & Status */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span className="eyebrow-label" style={{ marginBottom: 0 }}>
                      GROUNDED REBUTTAL
                    </span>
                    <span
                      className={`status-pill ${isResolved ? "status-pill--grey" : "status-pill--crimson"}`}
                      style={{ fontSize: "0.7rem" }}
                    >
                      {rebuttal?.resolution || "PENDING"}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.95rem", color: "var(--text-body)", lineHeight: 1.6 }}>
                    {rebuttal?.response || "Counter-rebuttal under formulation."}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 5: FORUM JURISDICTION & LIMITATION PERIOD */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">PROCEDURAL ADMISSIBILITY</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
            Forum Jurisdiction &amp; Limitation
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2.5rem", borderTop: "1px solid var(--border-hairline)", paddingTop: "1.75rem" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <span className="eyebrow-label" style={{ marginBottom: 0 }}>APPROPRIATE FORUM</span>
              {data.forum?.unverified && (
                <span className="status-pill status-pill--crimson" style={{ fontSize: "0.7rem" }}>Unverified</span>
              )}
            </div>
            <p data-testid="forum-result" style={{ fontSize: "1.05rem", fontWeight: 700, color: "#000000", marginBottom: "0.35rem" }}>
              {data.forum?.commission_level}
            </p>
            <p style={{ fontSize: "0.92rem", color: "var(--text-body)", lineHeight: 1.6 }}>
              {data.forum?.reasoning}
            </p>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <span className="eyebrow-label" style={{ marginBottom: 0 }}>LIMITATION STATUS</span>
              {data.limitation?.unverified && (
                <span className="status-pill status-pill--crimson" style={{ fontSize: "0.7rem" }}>Unverified</span>
              )}
            </div>
            <p data-testid="limitation-result" style={{ fontSize: "1.05rem", fontWeight: 700, color: "#000000", marginBottom: "0.35rem" }}>
              {data.limitation?.result}
            </p>
            <p style={{ fontSize: "0.92rem", color: "var(--text-body)", lineHeight: 1.6 }}>
              {data.limitation?.reasoning}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 6: EVIDENCE COVERAGE MATRIX */}
      {data.evidence_matrix?.length > 0 && (
        <section style={{ marginBottom: "3.5rem" }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <span className="eyebrow-label">SUBSTANTIATION AUDIT</span>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
              Evidence-to-Issue Coverage Matrix
            </h2>
          </div>

          <div style={{ borderTop: "1px solid var(--border-hairline)" }}>
            {data.evidence_matrix.map((item) => {
              const isSatisfied = item.status === "COVERED" || item.status === "SATISFIED";

              return (
                <div
                  key={item.issue_id}
                  style={{
                    padding: "1.25rem 0",
                    borderBottom: "1px solid var(--border-hairline)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#000000", marginRight: "0.75rem" }}>
                      {item.issue_id}
                    </span>
                    <span style={{ fontSize: "0.95rem", color: "var(--text-body)" }}>
                      {item.note}
                    </span>
                  </div>
                  <span className={`status-pill ${isSatisfied ? "status-pill--grey" : "status-pill--crimson"}`}>
                    {item.status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 7: NEUTRAL QUALITATIVE EVALUATION (No score, no percentage) */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">QUALITATIVE ASSESSMENT</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
            Neutral Evaluation
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--text-body)" }}>
            Objective assessment of statutory standing. CaseSeva never provides win probabilities or success percentages.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", borderTop: "1px solid var(--border-hairline)", paddingTop: "1.75rem" }}>
          <div>
            <span className="eyebrow-label" style={{ color: "#000000" }}>STRENGTHS</span>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.65, color: "var(--text-body)" }}>
              {data.neutral_evaluation?.strengths?.join(" ") || "No particular strengths isolated."}
            </p>
          </div>

          <div>
            <span className="eyebrow-label">WEAKNESSES &amp; RISKS</span>
            <p style={{ fontSize: "0.95rem", lineHeight: 1.65, color: "var(--text-body)" }}>
              {[
                ...(data.neutral_evaluation?.weaknesses || []),
                ...(data.neutral_evaluation?.unresolved_risks || [])
              ].join(" ") || "No major open risks identified."}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 8: OUTSTANDING DOCUMENT REQUESTS */}
      <section style={{ marginBottom: "4rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">DOCUMENTATION COMPLETION</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
            Outstanding Document Requests
          </h2>
        </div>

        {(data.document_requests || []).filter((item) => !item.resolved).length === 0 ? (
          <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", padding: "1rem 0", borderTop: "1px solid var(--border-hairline)" }}>
            All essential documents for confirmed legal issues are present in the record.
          </p>
        ) : (
          <div style={{ borderTop: "1px solid var(--border-hairline)" }}>
            {(data.document_requests || [])
              .filter((item) => !item.resolved)
              .map((item) => (
                <article
                  key={item.request_id}
                  data-testid="document-request"
                  style={{
                    padding: "1.5rem 0",
                    borderBottom: "1px solid var(--border-hairline)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "1.25rem",
                  }}
                >
                  <div>
                    <span className="status-pill status-pill--crimson" style={{ marginRight: "0.6rem" }}>
                      REQUIRED
                    </span>
                    <strong style={{ fontSize: "0.95rem", color: "#000000" }}>{item.request_id}:</strong>{" "}
                    <span style={{ fontSize: "0.95rem", color: "var(--text-body)" }}>{item.description}</span>
                  </div>
                  <input
                    type="file"
                    onChange={(e) => uploadRequest(item.request_id, e)}
                    disabled={busy}
                    style={{ width: "auto", fontSize: "0.85rem" }}
                  />
                </article>
              ))}
          </div>
        )}
      </section>

      {/* APPROVAL FOOTER (Prominent at end of scrolling) */}
      <div style={{ borderTop: "1px solid var(--border-hairline)", paddingTop: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.5rem" }}>
        <button type="button" className="btn-text-link" onClick={() => navigate(`/cases/${caseId}`)}>
          <ArrowLeft size={15} />
          <span>Back to case file</span>
        </button>

        <button type="button" className="btn-pill-primary" onClick={approve} disabled={busy}>
          <span>Approve and continue to advocate review</span>
          <ArrowUpRight size={16} />
        </button>
      </div>
    </main>
  );
}
