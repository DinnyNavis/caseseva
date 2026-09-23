import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  X,
  ExternalLink,
  Edit2,
  AlertTriangle,
  RotateCcw,
  Plus,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getAdvocateCase,
  approveAdvocateFact,
  editAdvocateFact,
  approveAdvocateProvision,
  removeAdvocateProvision,
  editAdvocateProvision,
  approveAdvocateForum,
  editAdvocateForum,
  approveAdvocateLimitation,
  editAdvocateLimitation,
  approveAdvocateArgument,
  editAdvocateArgument,
  approveAdvocateEvidence,
  removeAdvocateEvidence,
  createAdvocateDocumentRequest,
  saveAdvocateNote,
  finalizeAdvocateCase,
} from "../api";

export default function AdvocateReviewPage() {
  const { caseId } = useParams();
  const [item, setItem] = useState(null);
  const [note, setNote] = useState("");
  const [rerunStages, setRerunStages] = useState([]);
  const [rerunReason, setRerunReason] = useState("");
  const [finalizeError, setFinalizeError] = useState("");
  const [blockedItems, setBlockedItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [editingFactId, setEditingFactId] = useState(null);
  const [editingFactText, setEditingFactText] = useState("");
  const [editingForum, setEditingForum] = useState(false);
  const [forumForm, setForumForm] = useState({ commission_level: "", territorial_basis: "" });
  const [editingLimitation, setEditingLimitation] = useState(false);
  const [limitationForm, setLimitationForm] = useState({ result: "", reasoning: "" });
  const [newDocReqDescription, setNewDocReqDescription] = useState("");
  const [showDocReqModal, setShowDocReqModal] = useState(false);

  const load = () =>
    getAdvocateCase(caseId).then((result) => {
      setItem(result.case);
      setNote(result.case.advocate_review_note || "");
      if (result.case.forum) {
        setForumForm({
          commission_level: result.case.forum.commission_level || "",
          territorial_basis: result.case.forum.territorial_basis || "",
        });
      }
      if (result.case.limitation) {
        setLimitationForm({
          result: result.case.limitation.result || "",
          reasoning: result.case.limitation.reasoning || "",
        });
      }
    });

  useEffect(() => {
    load();
  }, [caseId]);

  if (!item) {
    return (
      <main className="main-container" style={{ paddingTop: "4rem", paddingBottom: "4rem" }}>
        <div style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
          Opening advocate review workspace…
        </div>
      </main>
    );
  }

  const approved = item.advocate_approved_items || [];
  const removed = item.advocate_removed_items || [];

  const activeFacts = (item.facts || []).filter((x) => !x.removed);
  const activeProvisions = (item.verified_legal_sections || []).filter((x) => !x.removed);
  const objections = item.arguments?.opponent?.objections || [];
  const hasForum = Boolean(item.forum);
  const hasLimitation = Boolean(item.limitation);

  const reviewableKeys = [
    ...activeFacts.map((f) => `fact:${f.fact_id}`),
    ...activeProvisions.map((p) => `provision:${p.provision_id}`),
    ...(hasForum ? ["forum:forum"] : []),
    ...(hasLimitation ? ["limitation:limitation"] : []),
    ...objections.map((o) => `argument:${o.objection_id}`),
  ];

  const doneKeys = reviewableKeys.filter((k) => approved.includes(k) || removed.includes(k));
  const outstandingCount = Math.max(reviewableKeys.length - doneKeys.length, 0);
  const editedCount = (item.facts || []).filter((f) => f.human_corrected).length;

  const handleApproveFact = async (factId) => {
    setBusy(true);
    try {
      await approveAdvocateFact(caseId, factId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveFactEdit = async (factId) => {
    setBusy(true);
    setRerunStages([]);
    setRerunReason("");
    try {
      const result = await editAdvocateFact(caseId, factId, { text: editingFactText });
      setItem(result.case);
      setEditingFactId(null);
      if (result.rerun_stages?.length > 0) {
        setRerunStages(result.rerun_stages);
        setRerunReason(`Corrected fact ${factId}. Dependent legal pipeline stages re-evaluated automatically.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleApproveProvision = async (provisionId) => {
    setBusy(true);
    try {
      await approveAdvocateProvision(caseId, provisionId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveProvision = async (provisionId) => {
    setBusy(true);
    setRerunStages([]);
    setRerunReason("");
    try {
      const result = await removeAdvocateProvision(caseId, provisionId);
      setItem(result.case);
      if (result.rerun_stages?.length > 0) {
        setRerunStages(result.rerun_stages);
        setRerunReason(`Removed provision ground '${provisionId}'. Dependent downstream legal analysis stages automatically re-executed.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleApproveForum = async () => {
    setBusy(true);
    try {
      await approveAdvocateForum(caseId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveForumEdit = async () => {
    setBusy(true);
    setRerunStages([]);
    setRerunReason("");
    try {
      const result = await editAdvocateForum(caseId, forumForm);
      setItem(result.case);
      setEditingForum(false);
      if (result.rerun_stages?.length > 0) {
        setRerunStages(result.rerun_stages);
        setRerunReason("Updated forum determination. Dependent evaluations updated.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleApproveLimitation = async () => {
    setBusy(true);
    try {
      await approveAdvocateLimitation(caseId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveLimitationEdit = async () => {
    setBusy(true);
    setRerunStages([]);
    setRerunReason("");
    try {
      const result = await editAdvocateLimitation(caseId, limitationForm);
      setItem(result.case);
      setEditingLimitation(false);
      if (result.rerun_stages?.length > 0) {
        setRerunStages(result.rerun_stages);
        setRerunReason("Updated limitation assessment. Downstream evaluation re-executed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleApproveArgument = async (objectionId) => {
    setBusy(true);
    try {
      await approveAdvocateArgument(caseId, objectionId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveNote = async () => {
    setBusy(true);
    try {
      await saveAdvocateNote(caseId, note);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleFinalize = async () => {
    setFinalizeError("");
    setBlockedItems([]);
    setBusy(true);
    try {
      await finalizeAdvocateCase(caseId);
      await load();
    } catch (err) {
      setFinalizeError(err.message || "Finalization blocked by outstanding unapproved items.");
      // If error payload has details
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.detail?.outstanding_items) {
          setBlockedItems(parsed.detail.outstanding_items);
        }
      } catch (e) {
        // Fallback: list remaining items from reviewable
        const remaining = reviewableKeys.filter((k) => !approved.includes(k) && !removed.includes(k));
        setBlockedItems(remaining);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreateDocRequest = async (e) => {
    e.preventDefault();
    if (!newDocReqDescription.trim()) return;
    setBusy(true);
    try {
      await createAdvocateDocumentRequest(caseId, { description: newDocReqDescription });
      setNewDocReqDescription("");
      setShowDocReqModal(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const isFinalized = item.status === "ADVOCATE_APPROVED" || item.status === "DOCUMENTS_READY";

  return (
    <main className="main-container" style={{ paddingTop: "2.5rem", paddingBottom: "6rem" }}>
      {/* Header */}
      <header style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span className="eyebrow-label">SUPERVISORY REVIEW · CASE #{caseId}</span>
            <div className="stacked-headline" style={{ margin: "0.4rem 0 0.75rem 0" }}>
              <div>ADVOCATE REVIEW /</div>
              <div className="stacked-headline__accent">
                {item.legal_domain?.domain?.toUpperCase() || "LEGAL CASE"}
              </div>
              <div className="hairline-gold" style={{ marginTop: "0.85rem", maxWidth: "160px" }} />
            </div>
          </div>

          <Link
            to="/advocate/dashboard"
            className="btn-pill-secondary"
            style={{ textDecoration: "none" }}
          >
            <span>&larr; Back to dashboard</span>
          </Link>
        </div>

        <p style={{ color: "var(--text-body)", fontSize: "0.95rem", maxWidth: "68ch", marginTop: "0.5rem" }}>
          Verify, edit, or prune automated intelligence. All human interventions are recorded in the permanent audit trail, and dependent analytical stages update selectively.
        </p>
      </header>

      {/* Persistent Sticky Review Summary Bar */}
      <div
        data-testid="review-summary"
        className="advocate-review-bar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap", fontSize: "0.88rem" }}>
          <div>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block" }}>
              Grounds Checked
            </span>
            <strong style={{ fontSize: "1.05rem", color: "#000000" }}>{doneKeys.length}</strong>
            <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}> of {reviewableKeys.length}</span>
          </div>

          <div>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block" }}>
              Human Edits
            </span>
            <strong style={{ fontSize: "1.05rem", color: "#000000" }}>{editedCount}</strong>
          </div>

          <div>
            <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", display: "block" }}>
              Pending Review
            </span>
            <strong style={{ fontSize: "1.05rem", color: outstandingCount > 0 ? "var(--status-crimson)" : "#000000" }}>
              {outstandingCount}
            </strong>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {isFinalized ? (
            <span style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#000000", display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <Check size={16} />
              <span>Review Finalized</span>
            </span>
          ) : (
            <span style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: outstandingCount === 0 ? "#000000" : "var(--status-crimson)" }}>
              {outstandingCount === 0 ? "✓ All Items Verified" : `${outstandingCount} Unreviewed`}
            </span>
          )}
        </div>
      </div>

      {/* Dependency Rerun Notification — Quiet reveal explaining exactly which stages reran */}
      {rerunStages.length > 0 && (
        <div className="rerun-callout">
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <span className="eyebrow-label">DEPENDENCY PIPELINE EXECUTED</span>
          </div>
          <p style={{ fontSize: "0.9rem", color: "var(--text-body)", marginBottom: "0.5rem" }}>
            {rerunReason}
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {rerunStages.map((st) => (
              <span
                key={st}
                style={{
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  background: "#EBEBEB",
                  color: "#000000",
                  padding: "0.15rem 0.45rem",
                  borderRadius: "2px",
                  fontWeight: 600,
                }}
              >
                {st}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Finalize Error Banner with explicit list of what is outstanding */}
      {finalizeError && (
        <div
          role="alert"
          style={{
            background: "#FAFAFA",
            borderLeft: "3px solid #000000",
            padding: "1.25rem 1.5rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
            <AlertTriangle size={18} style={{ color: "#000000" }} />
            <strong style={{ fontSize: "0.95rem", color: "#000000" }}>
              Finalization Blocked
            </strong>
          </div>
          <p style={{ fontSize: "0.9rem", color: "var(--text-body)" }}>
            {finalizeError}
          </p>
          {blockedItems.length > 0 && (
            <div style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
              <span style={{ fontWeight: 600, color: "#000000" }}>Outstanding items requiring approval:</span>
              <ul style={{ margin: "0.35rem 0 0 1.25rem", color: "var(--text-muted)" }}>
                {blockedItems.map((itemKey) => (
                  <li key={itemKey}><code>{itemKey}</code></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 1: Client Narrative & Facts with Evidence Pairing ── */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ borderBottom: "2px solid #000000", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">GROUND TRUTH</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000", marginTop: "0.2rem" }}>
            Client narrative & extracted facts
          </h2>
        </div>

        {/* Narrative Box */}
        <div style={{ background: "#FAFAFA", padding: "1.5rem", border: "1px solid var(--border-hairline)", marginBottom: "2rem" }}>
          <span className="eyebrow-label" style={{ marginBottom: "0.5rem" }}>UNSEALED CLIENT STORY</span>
          <p style={{ fontSize: "0.95rem", color: "var(--text-body)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {item.client_story || "No raw narrative recorded."}
          </p>
        </div>

        {/* Extracted Facts List */}
        <div>
          {activeFacts.map((fact) => {
            const isApproved = approved.includes(`fact:${fact.fact_id}`);
            const isEditing = editingFactId === fact.fact_id;

            // Pair fact with supporting evidence
            const supportingEvidence = (item.evidence || []).filter((e) =>
              fact.evidence_ids?.includes(e.evidence_id) ||
              (e.description && fact.text?.toLowerCase().includes(e.description.toLowerCase()))
            );

            return (
              <article key={fact.fact_id} className="review-item-row">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span className="eyebrow-label">
                      FACT #{fact.fact_id}
                    </span>
                    {fact.human_corrected && (
                      <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", fontWeight: 600 }}>
                        (Human Corrected)
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    {!isEditing && (
                      <button
                        type="button"
                        className="btn-text-link"
                        style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}
                        onClick={() => {
                          setEditingFactId(fact.fact_id);
                          setEditingFactText(fact.text);
                        }}
                        disabled={busy}
                      >
                        Edit fact
                      </button>
                    )}

                    {isApproved ? (
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#000000", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <Check size={15} />
                        <span>Approved</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-pill-primary"
                        style={{ padding: "0.35rem 0.85rem", fontSize: "0.82rem" }}
                        onClick={() => handleApproveFact(fact.fact_id)}
                        disabled={busy}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div style={{ marginTop: "0.5rem" }}>
                    <textarea
                      className="clean-input"
                      style={{ width: "100%", padding: "0.75rem", fontSize: "0.92rem", lineHeight: 1.6 }}
                      rows={3}
                      value={editingFactText}
                      onChange={(e) => setEditingFactText(e.target.value)}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.5rem" }}>
                      <button
                        type="button"
                        className="btn-text-link"
                        style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}
                        onClick={() => setEditingFactId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-pill-primary"
                        style={{ padding: "0.35rem 0.85rem", fontSize: "0.82rem" }}
                        onClick={() => handleSaveFactEdit(fact.fact_id)}
                        disabled={busy}
                      >
                        Save & Rerun
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: "0.95rem", color: "#000000", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                    {fact.text}
                  </p>
                )}

                {/* Paired Evidence Chip */}
                {supportingEvidence.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>
                      Supporting evidence:
                    </span>
                    {supportingEvidence.map((ev) => (
                      <span key={ev.evidence_id} className="evidence-chip">
                        {ev.evidence_id}: {ev.filename || ev.description}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ── SECTION 2: Verified Legal Provisions ── */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ borderBottom: "2px solid #000000", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">STATUTORY FOUNDATION</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000", marginTop: "0.2rem" }}>
            Legal provisions & grounded citations
          </h2>
        </div>

        <div>
          {activeProvisions.map((provision) => {
            const isApproved = approved.includes(`provision:${provision.provision_id}`);

            return (
              <article key={provision.provision_id} className="review-item-row">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "0.5rem" }}>
                  <div>
                    <span className="eyebrow-label" style={{ marginBottom: "0.25rem" }}>
                      SECTION #{provision.provision_id}
                    </span>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#000000" }}>
                      {provision.title}
                    </h3>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <button
                      type="button"
                      className="btn-text-link"
                      style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}
                      onClick={() => handleRemoveProvision(provision.provision_id)}
                      disabled={busy}
                    >
                      Remove this ground
                    </button>

                    {isApproved ? (
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#000000", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <Check size={15} />
                        <span>Approved</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-pill-primary"
                        style={{ padding: "0.35rem 0.85rem", fontSize: "0.82rem" }}
                        onClick={() => handleApproveProvision(provision.provision_id)}
                        disabled={busy}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: "0.92rem", color: "var(--text-body)", lineHeight: 1.6, marginBottom: "0.5rem" }}>
                  {provision.explanation}
                </p>

                {provision.source_url && (
                  <div>
                    <a
                      href={provision.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-text-link"
                      style={{ fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                    >
                      <span>Official Act text</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ── SECTION 3: Forum & Limitation Analysis ── */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ borderBottom: "2px solid #000000", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">JURISDICTION & TIMELINESS</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000", marginTop: "0.2rem" }}>
            Forum & limitation determination
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem" }}>
          {/* Forum */}
          <div className="review-item-row" style={{ borderBottom: "none", borderTop: "none", padding: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
              <span className="eyebrow-label">FORUM DETERMINATION</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {!editingForum && (
                  <button
                    type="button"
                    className="btn-text-link"
                    style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}
                    onClick={() => setEditingForum(true)}
                    disabled={busy}
                  >
                    Edit
                  </button>
                )}
                {approved.includes("forum:forum") ? (
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#000000" }}>✓ Approved</span>
                ) : (
                  <button
                    type="button"
                    className="btn-pill-primary"
                    style={{ padding: "0.3rem 0.75rem", fontSize: "0.82rem" }}
                    onClick={handleApproveForum}
                    disabled={busy}
                  >
                    Approve
                  </button>
                )}
              </div>
            </div>

            {editingForum ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <input
                  className="clean-input"
                  placeholder="Commission Level"
                  value={forumForm.commission_level}
                  onChange={(e) => setForumForm({ ...forumForm, commission_level: e.target.value })}
                />
                <input
                  className="clean-input"
                  placeholder="Territorial Basis"
                  value={forumForm.territorial_basis}
                  onChange={(e) => setForumForm({ ...forumForm, territorial_basis: e.target.value })}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <button type="button" className="btn-text-link" onClick={() => setEditingForum(false)}>Cancel</button>
                  <button type="button" className="btn-pill-primary" style={{ padding: "0.3rem 0.75rem" }} onClick={handleSaveForumEdit}>Save</button>
                </div>
              </div>
            ) : (
              <div>
                <strong style={{ fontSize: "1.05rem", color: "#000000", display: "block", marginBottom: "0.35rem" }}>
                  {item.forum?.commission_level || "Jurisdiction under review"}
                </strong>
                <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  Basis: {item.forum?.territorial_basis || "Not specified"}
                </p>
              </div>
            )}
          </div>

          {/* Limitation */}
          <div className="review-item-row" style={{ borderBottom: "none", borderTop: "none", padding: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
              <span className="eyebrow-label">STATUTORY LIMITATION</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {!editingLimitation && (
                  <button
                    type="button"
                    className="btn-text-link"
                    style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}
                    onClick={() => setEditingLimitation(true)}
                    disabled={busy}
                  >
                    Edit
                  </button>
                )}
                {approved.includes("limitation:limitation") ? (
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#000000" }}>✓ Approved</span>
                ) : (
                  <button
                    type="button"
                    className="btn-pill-primary"
                    style={{ padding: "0.3rem 0.75rem", fontSize: "0.82rem" }}
                    onClick={handleApproveLimitation}
                    disabled={busy}
                  >
                    Approve
                  </button>
                )}
              </div>
            </div>

            {editingLimitation ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <input
                  className="clean-input"
                  placeholder="Limitation Result (e.g. TIMELY)"
                  value={limitationForm.result}
                  onChange={(e) => setLimitationForm({ ...limitationForm, result: e.target.value })}
                />
                <textarea
                  className="clean-input"
                  rows={2}
                  placeholder="Reasoning"
                  value={limitationForm.reasoning}
                  onChange={(e) => setLimitationForm({ ...limitationForm, reasoning: e.target.value })}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                  <button type="button" className="btn-text-link" onClick={() => setEditingLimitation(false)}>Cancel</button>
                  <button type="button" className="btn-pill-primary" style={{ padding: "0.3rem 0.75rem" }} onClick={handleSaveLimitationEdit}>Save</button>
                </div>
              </div>
            ) : (
              <div>
                <strong style={{ fontSize: "1.05rem", color: "#000000", display: "block", marginBottom: "0.35rem" }}>
                  {item.limitation?.result || "Assessment Pending"}
                </strong>
                <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {item.limitation?.reasoning || "Limitation trigger event analysis."}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: Opponent Objections & Rebuttals ── */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ borderBottom: "2px solid #000000", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">COUNTER-STRATEGY</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000", marginTop: "0.2rem" }}>
            Opponent objections & strategic rebuttals
          </h2>
        </div>

        <div>
          {objections.map((objection) => {
            const isApproved = approved.includes(`argument:${objection.objection_id}`);
            const rebuttal = item.arguments?.rebuttal?.rebuttals?.find(
              (x) => x.objection_id === objection.objection_id
            );

            return (
              <article key={objection.objection_id} className="objection-rebuttal-grid">
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
                    <span className="eyebrow-label">OBJECTION #{objection.objection_id}</span>
                  </div>
                  <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#000000", lineHeight: 1.5 }}>
                    {objection.text}
                  </p>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.35rem" }}>
                    <span className="eyebrow-label">CLAIMANT REBUTTAL</span>

                    {isApproved ? (
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#000000", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <Check size={14} />
                        <span>Addressed</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-pill-primary"
                        style={{ padding: "0.3rem 0.75rem", fontSize: "0.82rem" }}
                        onClick={() => handleApproveArgument(objection.objection_id)}
                        disabled={busy}
                      >
                        Approve rebuttal
                      </button>
                    )}
                  </div>

                  <p style={{ fontSize: "0.92rem", color: "var(--text-body)", lineHeight: 1.6 }}>
                    {rebuttal?.response || "Strategic rebuttal analysis pending."}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── SECTION 5: Qualitative Evaluation (Zero percentages, zero scores) ── */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ borderBottom: "2px solid #000000", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
          <span className="eyebrow-label">NEUTRAL ASSESSMENT</span>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000", marginTop: "0.2rem" }}>
            Qualitative strengths, weaknesses & open risks
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2rem" }}>
          <div>
            <span className="eyebrow-label" style={{ marginBottom: "0.5rem" }}>KEY STRENGTHS</span>
            <ul style={{ listStyle: "disc", paddingLeft: "1.25rem", fontSize: "0.9rem", color: "var(--text-body)", lineHeight: 1.6 }}>
              {(item.neutral_evaluation?.strengths || ["Documented timeline of purchase and failure", "Authorised service centre defect confirmation"]).map((s, i) => (
                <li key={i} style={{ marginBottom: "0.35rem" }}>{s}</li>
              ))}
            </ul>
          </div>

          <div>
            <span className="eyebrow-label" style={{ marginBottom: "0.5rem" }}>POTENTIAL VULNERABILITIES</span>
            <ul style={{ listStyle: "disc", paddingLeft: "1.25rem", fontSize: "0.9rem", color: "var(--text-body)", lineHeight: 1.6 }}>
              {(item.neutral_evaluation?.weaknesses || ["Opponent will assert warranty repair satisfies contractual liability"]).map((w, i) => (
                <li key={i} style={{ marginBottom: "0.35rem" }}>{w}</li>
              ))}
            </ul>
          </div>

          <div>
            <span className="eyebrow-label" style={{ marginBottom: "0.5rem" }}>OPEN RISKS</span>
            <ul style={{ listStyle: "disc", paddingLeft: "1.25rem", fontSize: "0.9rem", color: "var(--text-body)", lineHeight: 1.6 }}>
              {(item.neutral_evaluation?.unresolved_risks || ["Territorial jurisdiction requires formal confirmation of seller operating address"]).map((r, i) => (
                <li key={i} style={{ marginBottom: "0.35rem" }}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: Advocate Document Requests ── */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #000000", paddingBottom: "0.5rem", marginBottom: "1.5rem" }}>
          <div>
            <span className="eyebrow-label">EVIDENTIARY REQUESTS</span>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000", marginTop: "0.2rem" }}>
              Outstanding client documents
            </h2>
          </div>

          <button
            type="button"
            className="btn-pill-secondary"
            onClick={() => setShowDocReqModal(true)}
            disabled={busy}
          >
            <Plus size={14} />
            <span>Request document</span>
          </button>
        </div>

        {item.advocate_document_requests?.length > 0 ? (
          <div>
            {item.advocate_document_requests.map((req) => (
              <div key={req.request_id} className="review-item-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="eyebrow-label">{req.request_id}</span>
                  <p style={{ fontSize: "0.92rem", color: "#000000", fontWeight: 600 }}>{req.description}</p>
                </div>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", color: req.resolved ? "#000000" : "var(--status-crimson)" }}>
                  {req.resolved ? "✓ Uploaded & Resolved" : "Awaiting Client Upload"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            No additional document requests raised. All essential records provided.
          </p>
        )}

        {showDocReqModal && (
          <div style={{ marginTop: "1.5rem", background: "#FAFAFA", padding: "1.5rem", border: "1px solid var(--border-hairline)" }}>
            <span className="eyebrow-label" style={{ marginBottom: "0.5rem" }}>NEW DOCUMENT REQUEST</span>
            <textarea
              className="clean-input"
              rows={3}
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.9rem" }}
              placeholder="Describe the exact document required from the client (e.g. GST Purchase Invoice, Service Centre Job Sheet)..."
              value={newDocReqDescription}
              onChange={(e) => setNewDocReqDescription(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "0.75rem" }}>
              <button type="button" className="btn-text-link" onClick={() => setShowDocReqModal(false)}>Cancel</button>
              <button type="button" className="btn-pill-primary" onClick={handleCreateDocRequest} disabled={busy}>Send Request</button>
            </div>
          </div>
        )}
      </section>

      {/* ── SECTION 7: Review Note & Finalize Action ── */}
      <section style={{ borderTop: "2px solid #000000", paddingTop: "2.5rem" }}>
        <span className="eyebrow-label">FINALIZATION</span>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "#000000", margin: "0.25rem 0 1rem 0" }}>
          Advocate review notes & approval
        </h2>

        <div style={{ marginBottom: "2rem" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#000000", marginBottom: "0.5rem" }}>
            Supervisory Review Comments (Recorded in client deliverable)
          </label>
          <textarea
            className="clean-input"
            rows={4}
            placeholder="Add advocate observations, specific court registry remarks, or instructions for client document signing..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: "100%", padding: "1rem", fontSize: "0.95rem", lineHeight: 1.6 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn-pill-secondary"
              onClick={handleSaveNote}
              disabled={busy}
            >
              Save note
            </button>
          </div>
        </div>

        {/* Finalize button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border-hairline)" }}>
          <div>
            <span style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {isFinalized
                ? "This case has been finalized by advocate review."
                : outstandingCount === 0
                ? "All review items approved. Ready to generate formal court drafts."
                : `${outstandingCount} unapproved review item(s) remain.`}
            </span>
          </div>

          <button
            type="button"
            className="btn-pill-primary"
            style={{ padding: "0.75rem 2rem", fontSize: "0.95rem" }}
            onClick={handleFinalize}
            disabled={busy || isFinalized}
          >
            <span>Finalize review</span>
            <ArrowUpRight size={16} />
          </button>
        </div>
      </section>
    </main>
  );
}
