import { useEffect, useState } from "react";
import { ArrowUpRight, Check, X, ShieldAlert } from "lucide-react";
import { listAdminAdvocates, verifyAdvocate } from "../api";

export default function AdminAdvocatesPage() {
  const [advocates, setAdvocates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    listAdminAdvocates()
      .then((result) => setAdvocates(result.advocates || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleVerify = async (id, status) => {
    setBusyId(id);
    try {
      await verifyAdvocate(id, status);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="main-container" style={{ paddingTop: "2.5rem", paddingBottom: "5rem" }}>
      {/* Header */}
      <header style={{ marginBottom: "2rem", borderBottom: "1px solid var(--border-hairline)", paddingBottom: "1.25rem" }}>
        <span className="eyebrow-label">INTERNAL ADMINISTRATION</span>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "#000000", marginTop: "0.25rem", marginBottom: "0.5rem" }}>
          Advocate verification console
        </h1>
        <p style={{ color: "var(--text-body)", fontSize: "0.92rem", maxWidth: "68ch" }}>
          Review advocate enrolment credentials and authorize practice access to the supervisory casework queue.
        </p>
      </header>

      {/* Visibly honest gate disclosure */}
      <div
        style={{
          background: "#FAFAFA",
          borderLeft: "3px solid #000000",
          padding: "1.25rem 1.5rem",
          marginBottom: "2.5rem",
        }}
      >
        <span className="eyebrow-label" style={{ marginBottom: "0.35rem" }}>SIMULATION NOTICE</span>
        <p style={{ fontSize: "0.9rem", color: "var(--text-body)", lineHeight: 1.6 }}>
          This administrative panel represents a simulated identity verification workflow for demonstration purposes. In a live production environment, enrolment records must be authenticated against digital registries maintained by respective State Bar Councils. Caseseva does not connect to a real-time Bar Council API in this demo environment; advocate verification is managed manually through this gate.
        </p>
      </div>

      {/* Advocates List */}
      {loading ? (
        <div style={{ padding: "3rem 0", color: "var(--text-muted)", fontSize: "0.92rem" }}>
          Loading advocate registration queue…
        </div>
      ) : advocates.length === 0 ? (
        <div style={{ padding: "3rem 0", borderBottom: "1px solid var(--border-hairline)" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>
            No advocates registered in the verification queue.
          </p>
        </div>
      ) : (
        <div style={{ borderTop: "2px solid #000000" }}>
          {advocates.map((advocate) => {
            const status = advocate.verification_status || "PENDING";
            const isVerified = status === "VERIFIED";
            const isRejected = status === "REJECTED";

            return (
              <article
                key={advocate.id}
                style={{
                  padding: "1.75rem 0",
                  borderBottom: "1px solid var(--border-hairline)",
                  display: "grid",
                  gap: "0.85rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#000000", marginBottom: "0.25rem" }}>
                      {advocate.full_name}
                    </h2>
                    <p style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
                      {advocate.bar_council || "Bar Council"} &middot; Enrolment: {advocate.enrolment_number || "N/A"} ({advocate.enrolment_year || "N/A"}) &middot; {advocate.place_of_practice || advocate.district_city || advocate.state || "India"}
                    </p>
                  </div>

                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: isVerified ? "#000000" : isRejected ? "var(--status-crimson)" : "var(--text-muted)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                    }}
                  >
                    {isVerified && <Check size={15} />}
                    {isRejected && <X size={15} />}
                    <span>{status}</span>
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "1.25rem", paddingTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn-text-link"
                    style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}
                    onClick={() => handleVerify(advocate.id, "REJECTED")}
                    disabled={busyId === advocate.id}
                  >
                    Reject
                  </button>

                  <button
                    type="button"
                    className="btn-pill-primary"
                    style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                    onClick={() => handleVerify(advocate.id, "VERIFIED")}
                    disabled={busyId === advocate.id || isVerified}
                  >
                    <span>{isVerified ? "Verified" : "Verify"}</span>
                    {!isVerified && <ArrowUpRight size={14} />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
