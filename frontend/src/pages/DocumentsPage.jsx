import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { documentDownloadUrl, getDocument, listDocuments, overrideDocumentConsistency, getMe } from "../api";
import { ArrowUpRight, ArrowLeft, Printer, Download, Eye, AlertCircle, CheckCircle2 } from "lucide-react";

export default function DocumentsPage() {
  const { caseId } = useParams();
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    listDocuments(caseId)
      .then((result) => setDocuments(result.documents || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    getMe().then((res) => setUser(res.user)).catch(() => {});
  }, [caseId]);

  const view = (id) => {
    getDocument(caseId, id).then((result) => setSelected(result.document));
  };

  const isAdvocate = user?.role === "advocate";

  if (loading && !documents.length) {
    return (
      <main className="main-container content-narrow" style={{ textAlign: "center", paddingTop: "5rem" }}>
        <span className="eyebrow-label">INITIALIZING</span>
        <p style={{ color: "var(--text-body)", fontSize: "1.05rem" }}>Loading case deliverables…</p>
      </main>
    );
  }

  return (
    <main className="main-container content-narrow" style={{ paddingBottom: "7rem" }}>
      {/* Editorial Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <span className="eyebrow-label">FINAL DELIVERABLES</span>
        <div className="hairline-gold" />

        <div className="stacked-headline" style={{ marginBottom: "1rem" }}>
          <h1 className="headline-secondary" style={{ margin: 0 }}>
            CASE DOCUMENTS
          </h1>
          <span className="headline-connective">AUDITED &amp;</span>
          <span className="headline-dominant" style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)" }}>
            COURT-READY.
          </span>
        </div>

        <p style={{ fontSize: "1.05rem", color: "var(--text-body)", lineHeight: 1.6, maxWidth: "56ch" }}>
          Complaint draft filings and case intelligence reports assembled from verified statutory text and approved factual evidence.
        </p>
      </div>

      <hr className="hairline-rule" style={{ margin: "1.5rem 0 2.5rem" }} />

      {/* Generated Documents List */}
      <section data-testid="document-list" style={{ marginBottom: "3.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
            Generated Files ({documents.length})
          </h2>
          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Earlier revisions preserved for audit trail
          </span>
        </div>

        {documents.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", padding: "2rem 0", borderTop: "1px solid var(--border-hairline)" }}>
            No documents generated yet for this case.
          </p>
        ) : (
          <div style={{ borderTop: "1px solid var(--border-hairline)" }}>
            {documents.map((doc) => {
              const failed = doc.consistency?.some((finding) => finding.result === "FAIL");
              const title = doc.type === "report" ? "Case Intelligence Report" : "Consumer Complaint Draft";

              return (
                <article
                  key={doc.id}
                  style={{
                    padding: "2rem 0",
                    borderBottom: "1px solid var(--border-hairline)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.25rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
                        <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#000000" }}>
                          {title}
                        </h3>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-muted)" }}>
                          v{doc.version}
                        </span>
                      </div>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        Generated on {new Date(doc.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span
                        data-testid="consistency-status"
                        className={failed ? "status-pill status-pill--crimson" : ""}
                        style={{
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          letterSpacing: "0.04em",
                          ...(failed
                            ? {}
                            : { color: "var(--text-heading)", display: "inline-flex", alignItems: "center", gap: "0.35rem" }),
                        }}
                      >
                        {failed ? "FAIL" : "✓ PASS"}
                      </span>
                    </div>
                  </div>

                  {/* Consistency checks breakdown */}
                  {doc.consistency?.length > 0 && (
                    <div style={{ background: "#FAFAFA", padding: "1.25rem 1.5rem", border: "1px solid var(--border-hairline)" }}>
                      <span className="eyebrow-label" style={{ marginBottom: "0.75rem" }}>
                        CONSISTENCY AUDIT CHECKS
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                        {doc.consistency.map((chk, i) => {
                          const isPass = chk.result === "PASS";
                          return (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontSize: "0.88rem",
                                padding: "0.35rem 0",
                              }}
                            >
                              <span style={{ color: "var(--text-body)" }}>
                                {chk.check}
                                {chk.location && (
                                  <span style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}>({chk.location})</span>
                                )}
                              </span>
                              <span
                                style={{
                                  color: isPass ? "var(--text-heading)" : "var(--status-crimson)",
                                  fontSize: "0.82rem",
                                  fontWeight: isPass ? 600 : 700,
                                }}
                              >
                                {isPass ? "✓ PASS" : "▲ FAIL"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Actions: View & Export */}
                  <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap", paddingTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="btn-pill-secondary"
                      onClick={() => view(doc.id)}
                    >
                      <Eye size={15} />
                      <span>View</span>
                    </button>

                    <a
                      href={documentDownloadUrl(caseId, doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-pill-primary"
                    >
                      <Download size={15} />
                      <span>Download export</span>
                    </a>

                    {/* Advocate-only override control */}
                    {isAdvocate && failed && (
                      <button
                        type="button"
                        className="btn-text-link"
                        style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}
                        onClick={async () => {
                          const reason = window.prompt("State legal reason for overriding consistency flag:");
                          if (reason) {
                            await overrideDocumentConsistency(caseId, doc.id, reason);
                            load();
                          }
                        }}
                      >
                        Override consistency
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Embedded Document Viewer — Printable editorial sheet */}
      {selected && (
        <section data-testid="document-viewer" style={{ marginTop: "3rem", borderTop: "2px solid #000000", paddingTop: "2.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
            <div>
              <span className="eyebrow-label">DOCUMENT VIEWER</span>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000" }}>
                Deliverable View &mdash; Version {selected.version}
              </h2>
              <p style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                Unfilled placeholders requiring advocate completion are highlighted below.
              </p>
            </div>

            <button
              type="button"
              className="btn-pill-secondary"
              onClick={() => window.print()}
            >
              <Printer size={15} />
              <span>Print / Save as PDF</span>
            </button>
          </div>

          {/* Document Sheet sitting on white */}
          <div className="document-sheet">
            <article
              className="document-content"
              dangerouslySetInnerHTML={{
                __html: selected.html.replaceAll("[TO BE COMPLETED:", "<mark>[TO BE COMPLETED:"),
              }}
            />
          </div>
        </section>
      )}

      {/* Back Navigation */}
      <div style={{ marginTop: "4rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border-hairline)" }}>
        <Link to={`/cases/${caseId}`} className="btn-text-link">
          <ArrowLeft size={15} />
          <span>Return to case file</span>
        </Link>
      </div>
    </main>
  );
}
