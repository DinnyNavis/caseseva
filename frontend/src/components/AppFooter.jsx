import { Link } from "react-router-dom";

export default function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer__grid">
        <div>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, letterSpacing: "-0.02em", color: "#000000", marginBottom: "0.5rem", textTransform: "uppercase" }}>
            CaseSeva
          </div>
          <p style={{ fontSize: "0.88rem", color: "var(--text-body)", maxWidth: "34ch", lineHeight: 1.5 }}>
            Automated casework analysis and statutory grounding for Indian legal proceedings.
          </p>
        </div>

        <div>
          <div className="eyebrow-label" style={{ marginBottom: "0.85rem" }}>Workspace</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.88rem" }}>
            <Link to="/dashboard" style={{ color: "var(--text-body)" }}>Client Portal</Link>
            <Link to="/cases/new" style={{ color: "var(--text-body)" }}>New Intake</Link>
            <Link to="/advocates" style={{ color: "var(--text-body)" }}>Advocate Directory</Link>
          </div>
        </div>

        <div>
          <div className="eyebrow-label" style={{ marginBottom: "0.85rem" }}>Statutes</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.88rem", color: "var(--text-body)" }}>
            <span>IndiaCode Retrieval</span>
            <span>Consumer Protection Act</span>
            <span>Code on Wages</span>
          </div>
        </div>

        <div>
          <div className="eyebrow-label" style={{ marginBottom: "0.85rem" }}>Principles</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", fontSize: "0.88rem", color: "var(--text-body)" }}>
            <span>No win predictions</span>
            <span>Grounded citations only</span>
            <span>Enrolled advocate review</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "var(--content-width)", margin: "0 auto", paddingTop: "2rem", borderTop: "1px solid var(--border-hairline)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", fontSize: "0.8rem", color: "var(--text-eyebrow)" }}>
        <span>© {new Date().getFullYear()} CaseSeva.ai · Grounded in official Indian statutory gazettes.</span>
        <span>Verified Casework Protocol</span>
      </div>
    </footer>
  );
}
