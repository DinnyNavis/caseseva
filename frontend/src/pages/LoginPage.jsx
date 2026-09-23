import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, setToken } from "../api";
import FormErrors from "../components/FormErrors";
import AppHeader from "../components/AppHeader";
import { ArrowUpRight } from "lucide-react";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      const result = await login(form);
      setToken(result.session_token);
      const target = result.user?.role === "advocate" ? "/advocate/dashboard" : "/dashboard";
      navigate(target, { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      setFieldErrors(requestError.fields || {});
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppHeader>
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="auth-split-screen">
          {/* Left Column: Editorial Statement with Restrained Gold Hairline */}
          <div className="auth-split-left">
            <div>
              <span className="eyebrow-label">ENTER CHAMBERS</span>
              <div className="hairline-gold" />
              
              <div className="stacked-headline" style={{ marginBottom: "1.5rem" }}>
                <span className="headline-secondary">PRECISION LEGAL</span>
                <span className="headline-secondary">INTELLIGENCE FOR</span>
                <span className="headline-gold" style={{ fontSize: "clamp(2rem, 4.5vw, 3.2rem)" }}>
                  INDIAN CASEWORK.
                </span>
              </div>

              <p style={{ fontSize: "1.05rem", color: "var(--text-body)", maxWidth: "42ch", lineHeight: 1.6 }}>
                Log in to audit verified statutory provisions, review court-ready complaint drafts, or finalize casework as an enrolled advocate.
              </p>
            </div>

            <div style={{ marginTop: "3rem", paddingTop: "2rem", borderTop: "1px solid var(--border-hairline)" }}>
              <span className="eyebrow-label" style={{ marginBottom: "0.4rem" }}>STATUTORY GROUNDING</span>
              <p style={{ fontSize: "0.85rem", color: "var(--text-body)" }}>
                Indexed against official indiacode.nic.in gazette acts. No hallucinated citations.
              </p>
            </div>
          </div>

          {/* Right Column: Clean Authentication Form */}
          <div className="auth-split-right">
            <div style={{ marginBottom: "2.25rem" }}>
              <span className="eyebrow-label">ACCOUNT ACCESS</span>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#000000", marginBottom: "0.5rem" }}>
                Welcome back
              </h1>
              <p style={{ fontSize: "0.95rem", color: "var(--text-body)" }}>
                Enter your credentials to access your CaseSeva workspace
              </p>
            </div>

            {error && (
              <div role="alert">
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} noValidate>
              <label htmlFor="email">
                Email
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  autoComplete="email"
                  placeholder="name@domain.com"
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
              <FormErrors errors={fieldErrors.email} />

              <label htmlFor="password">
                Password
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                />
              </label>
              <FormErrors errors={fieldErrors.password} />

              <button
                type="submit"
                className="btn-pill-primary btn-full"
                disabled={loading}
                style={{ marginTop: "1rem", padding: "0.9rem" }}
              >
                <span>{loading ? "Logging in…" : "Log in"}</span>
                <ArrowUpRight size={16} />
              </button>
            </form>

            <div style={{ marginTop: "2.5rem", paddingTop: "1.75rem", borderTop: "1px solid var(--border-hairline)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.9rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Don't have an account?</span>
              <Link to="/signup" className="btn-text-link">
                Create an account
              </Link>
            </div>
          </div>
        </div>
      </main>
    </AppHeader>
  );
}
