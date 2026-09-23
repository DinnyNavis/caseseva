import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, X, Shield, Inbox } from "lucide-react";
import { acceptAdvocateRequest, declineAdvocateRequest, getAdvocateRequests, getMe } from "../api";

export default function AdvocateInboxPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);

  const load = () => {
    setLoading(true);
    getMe().then((res) => setUser(res.user)).catch(() => {});
    getAdvocateRequests()
      .then((result) => setRequests(result.requests || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAccept = async (caseId) => {
    setBusy(true);
    try {
      await acceptAdvocateRequest(caseId);
      load();
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async (caseId) => {
    const reason = window.prompt("Optional reason for declining this representation request:") || "";
    setBusy(true);
    try {
      await declineAdvocateRequest(caseId, reason);
      load();
    } finally {
      setBusy(false);
    }
  };

  const isPending = user?.verification_status === "PENDING";

  return (
    <main className="main-container" style={{ paddingTop: "2.5rem", paddingBottom: "5rem" }}>
      {/* Header with Stacked Treatment */}
      <header style={{ marginBottom: "2.5rem" }}>
        <span className="eyebrow-label">REPRESENTATION INTAKE</span>
        <div className="stacked-headline" style={{ margin: "0.4rem 0 0.75rem 0" }}>
          <div>CLIENT INTAKE /</div>
          <div className="stacked-headline__accent">CASE INBOX</div>
          <div className="hairline-gold" style={{ marginTop: "0.85rem", maxWidth: "160px" }} />
        </div>
        <p style={{ color: "var(--text-body)", fontSize: "0.95rem", maxWidth: "60ch", marginTop: "0.75rem" }}>
          Representation requests submitted by verified clients. Key jurisdictional and risk summaries are unsealed; complete client narrative and evidentiary annexures become accessible immediately upon acceptance.
        </p>
      </header>

      {/* Requests List or Real Empty State */}
      {loading ? (
        <div style={{ padding: "4rem 0", color: "var(--text-muted)", fontSize: "0.92rem" }}>
          Loading pending requests…
        </div>
      ) : requests.length === 0 ? (
        <section style={{ padding: "4rem 0", borderTop: "1px solid var(--border-hairline)", borderBottom: "1px solid var(--border-hairline)" }}>
          <span className="eyebrow-label">QUEUE STATUS</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000", margin: "0.35rem 0 0.5rem 0" }}>
            Your case intake queue is clear
          </h2>
          <p style={{ color: "var(--text-body)", fontSize: "0.92rem", lineHeight: 1.6, maxWidth: "56ch" }}>
            You have no pending client representation requests at this moment. When clients complete their statutory analysis and request your representation from the verified directory, their dossiers will appear here.
          </p>
          <div style={{ marginTop: "1.75rem" }}>
            <Link
              to="/advocate/dashboard"
              className="btn-pill-secondary"
              style={{ textDecoration: "none" }}
            >
              <span>Return to workspace</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </section>
      ) : (
        <div style={{ borderTop: "2px solid #000000" }}>
          {requests.map((item) => (
            <article
              key={item.case_id}
              data-testid="advocate-request"
              style={{
                padding: "2rem 0",
                borderBottom: "1px solid var(--border-hairline)",
                display: "grid",
                gap: "1.25rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <span className="eyebrow-label" style={{ marginBottom: "0.3rem" }}>
                    Case #{item.case_id}
                  </span>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#000000" }}>
                    {item.domain || "Legal Case"}{item.sub_domain ? ` · ${item.sub_domain}` : ""}
                  </h2>
                </div>

                <span style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                  Awaiting Acceptance
                </span>
              </div>

              {/* Summary only — deliberate boundary: no client story leaked before acceptance */}
              <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
                <div>
                  <span style={{ display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                    Forum Level
                  </span>
                  <strong style={{ color: "#000000" }}>{item.forum_level || "Not specified"}</strong>
                </div>

                <div>
                  <span style={{ display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                    Evidence Attached
                  </span>
                  <strong style={{ color: "#000000" }}>{item.evidence_count} evidence files</strong>
                </div>

                <div>
                  <span style={{ display: "block", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                    Unresolved Risks
                  </span>
                  <strong style={{ color: "#000000" }}>
                    {item.unresolved_risks_count} open risks
                  </strong>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "1.5rem", paddingTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn-text-link"
                  style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}
                  onClick={() => handleDecline(item.case_id)}
                  disabled={busy || isPending}
                >
                  Decline
                </button>
                <button
                  type="button"
                  className="btn-pill-primary"
                  onClick={() => handleAccept(item.case_id)}
                  disabled={busy || isPending}
                >
                  <span>Accept representation</span>
                  <ArrowUpRight size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
