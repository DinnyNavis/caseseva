import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createCase, deleteEvidence, getCase, submitCase, updateCase, updateEvidence, uploadEvidence,
} from "../api";
import { ArrowUpRight, ArrowLeft, Upload, Check } from "lucide-react";

const STAGES = [
  { id: "NEW_CONSULTATION", title: "New / Consultation", text: "No formal proceeding exists yet." },
  { id: "COMPLAINT_FIR", title: "Complaint / FIR exists", text: "A police or authority step has already happened." },
  { id: "EXISTING_OLD_CASE", title: "Existing / Old case", text: "A case is already pending or decided." },
];

const emptyDetails = {
  has_fir: "", reference_number: "", station_authority: "",
  case_number: "", court_authority: "", current_stage: ""
};

function Field({ label, name, value, onChange, error }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <label htmlFor={name}>
        {label}
        <input
          id={name}
          name={name}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          style={{ marginTop: "0.4rem" }}
        />
      </label>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export default function CaseCreatePage() {
  const { caseId: routeCaseId } = useParams();
  const initialized = useRef(false);
  const caseIdRef = useRef(routeCaseId || null);
  const creatingPromiseRef = useRef(null);
  const [caseId, setCaseId] = useState(routeCaseId || null);
  const [loadingCase, setLoadingCase] = useState(Boolean(routeCaseId));
  const [stage, setStage] = useState("");
  const [details, setDetails] = useState(emptyDetails);
  const [story, setStory] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const [savingStory, setSavingStory] = useState(false);
  const [storySaved, setStorySaved] = useState(false);
  const navigate = useNavigate();

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const detailsRef = useRef(details);
  detailsRef.current = details;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (routeCaseId) {
      setLoadingCase(true);
      getCase(routeCaseId)
        .then((result) => {
          const item = result.case;
          caseIdRef.current = item.case_id;
          setCaseId(item.case_id);
          setStage(item.stage || "");
          stageRef.current = item.stage || "";
          setDetails(item.stage_details || emptyDetails);
          detailsRef.current = item.stage_details || emptyDetails;
          setStory(item.client_story || "");
          setEvidence(item.evidence || []);
          if (item.client_story) setStorySaved(true);
          if (item.stage) setStep(2);
        })
        .catch(() => {})
        .finally(() => setLoadingCase(false));
    }
  }, [routeCaseId]);

  const ensureCaseCreated = async () => {
    if (caseIdRef.current) return caseIdRef.current;
    if (creatingPromiseRef.current) return creatingPromiseRef.current;
    creatingPromiseRef.current = (async () => {
      try {
        const result = await createCase();
        const newId = result.case.case_id;
        caseIdRef.current = newId;
        setCaseId(newId);
        navigate(`/cases/${newId}/edit`, { replace: true });
        return newId;
      } catch (err) {
        throw err;
      }
    })();
    try {
      return await creatingPromiseRef.current;
    } finally {
      creatingPromiseRef.current = null;
    }
  };

  const save = async (next = {}) => {
    const activeId = await ensureCaseCreated();
    const payload = {};
    const activeStage = next.stage ?? stageRef.current ?? stage;
    if (activeStage) payload.stage = activeStage;
    const activeDetails = next.details ?? detailsRef.current ?? details;
    if (activeDetails) payload.stage_details = activeDetails;
    if (next.story !== undefined || story) {
      payload.client_story = next.story ?? story;
    }
    const result = await updateCase(activeId, payload);
    setErrors({});
    return result.case;
  };

  const chooseStage = async (nextStage) => {
    setStage(nextStage);
    stageRef.current = nextStage;
    setDetails(emptyDetails);
    detailsRef.current = emptyDetails;
    setErrors({});
    try {
      const activeId = await ensureCaseCreated();
      await updateCase(activeId, { stage: nextStage, stage_details: emptyDetails });
    } catch {}
  };

  const nextFromStage = async () => {
    const activeStage = stageRef.current || stage;
    const activeDetails = detailsRef.current || details;
    if (!activeStage) {
      setErrors({ stage: "Choose a case stage." });
      return;
    }
    setStep(2);
    setErrors({});
    try {
      const activeId = await ensureCaseCreated();
      await updateCase(activeId, { stage: activeStage, stage_details: activeDetails });
    } catch (error) {
      if (error.fields) {
        setStep(1);
        setErrors(error.fields || {});
      }
    }
  };

  const updateStory = async (value) => {
    setStory(value);
    setStorySaved(false);
    if (value.trim()) {
      setSavingStory(true);
      try {
        const activeId = await ensureCaseCreated();
        const activeStage = stageRef.current || stage;
        const payload = { client_story: value };
        if (activeStage) payload.stage = activeStage;
        await updateCase(activeId, payload);
        setStorySaved(true);
      } catch {}
      setSavingStory(false);
    }
  };

  const addEvidence = async (event) => {
    setMessage("");
    const activeId = await ensureCaseCreated();
    for (const file of Array.from(event.target.files || [])) {
      try {
        const result = await uploadEvidence(activeId, file);
        setEvidence((current) => [...current, result.evidence]);
      } catch (error) {
        setMessage(error.message);
      }
    }
    event.target.value = "";
  };

  const removeEvidence = async (id) => {
    if (!caseIdRef.current) return;
    const targetId = caseIdRef.current;
    try {
      await deleteEvidence(targetId, id);
      setEvidence((current) => current.filter((item) => item.evidence_id !== id));
    } catch (error) {
      setMessage(error.message);
    }
  };

  const changeDescription = async (item, description) => {
    if (!caseId) return;
    setEvidence((current) => current.map((entry) => entry.evidence_id === item.evidence_id ? { ...entry, description } : entry));
    await updateEvidence(caseId, item.evidence_id, description);
  };

  const finish = async () => {
    try {
      const activeId = await ensureCaseCreated();
      await save();
      const result = await submitCase(activeId);
      navigate(`/cases/${result.case.case_id}`);
    } catch (error) {
      setErrors(error.fields || {});
      const detailsText = Object.values(error.fields || {}).join(" ");
      setMessage([error.message, detailsText].filter(Boolean).join(" "));
    }
  };

  if (loadingCase) {
    return (
      <main className="main-container content-narrow" style={{ paddingTop: "5rem", textAlign: "center" }}>
        <span className="eyebrow-label">INITIALIZING</span>
        <p style={{ color: "var(--text-body)", fontSize: "1.1rem" }}>Preparing case workspace…</p>
      </main>
    );
  }

  const currentStage = STAGES.find((item) => item.id === stage);
  const wordCount = story.trim() ? story.trim().split(/\s+/).length : 0;

  return (
    <main className="main-container content-narrow" style={{ paddingBottom: "6rem" }}>
      {/* Intake Editorial Header */}
      <div style={{ marginBottom: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span className="eyebrow-label">CASE INTAKE PROTOCOL</span>
            <div className="hairline-gold" style={{ marginBottom: "1rem" }} />
            <div className="stacked-headline" style={{ marginBottom: "0.5rem" }}>
              <h1 className="headline-secondary" style={{ margin: 0 }}>
                {step === 1 && "PROCEDURAL STAGE"}
                {step === 2 && "YOUR STORY"}
                {step === 3 && "DOCUMENTARY EVIDENCE"}
                {step === 4 && "REVIEW & SUBMISSION"}
              </h1>
            </div>
          </div>

          <span className="status-pill status-pill--grey" data-testid="progress">
            Step {step} of 4
          </span>
        </div>

        {/* Minimal Progress Line */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem", marginTop: "1rem" }}>
          {[1, 2, 3, 4].map((num) => (
            <div
              key={num}
              onClick={() => num < step && setStep(num)}
              style={{
                height: "2px",
                background: num <= step ? "#000000" : "var(--border-hairline)",
                cursor: num < step ? "pointer" : "default",
                transition: "background 150ms ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content Sits Directly on White — NO Cards, NO Boxes */}
      <div>
        {/* STEP 1: STAGE SELECTION */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: "1.05rem", color: "var(--text-body)", marginBottom: "2rem" }}>
              Select the option that best describes your matter's current legal status.
            </p>

            {errors.stage && <p className="field-error" style={{ marginBottom: "1.5rem" }}>{errors.stage}</p>}

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2.5rem" }}>
              {STAGES.map((item) => {
                const selected = stage === item.id;
                return (
                  <button
                    type="button"
                    key={item.id}
                    data-testid={`stage-${item.id}`}
                    onClick={() => chooseStage(item.id)}
                    style={{
                      textAlign: "left",
                      padding: "1.5rem 1.75rem",
                      background: "#FFFFFF",
                      border: selected ? "2px solid #000000" : "1px solid var(--border-hairline)",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "border-color 150ms ease",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#000000", marginBottom: "0.25rem" }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "var(--text-body)" }}>
                        {item.text}
                      </div>
                    </div>
                    {selected && <Check size={20} color="#000000" strokeWidth={2.5} />}
                  </button>
                );
              })}
            </div>

            {/* Conditional Stage Details */}
            {stage === "COMPLAINT_FIR" && (
              <div style={{ padding: "2rem 0", borderTop: "1px solid var(--border-hairline)", marginBottom: "2rem" }}>
                <span className="eyebrow-label" style={{ color: "#000000", marginBottom: "1.25rem" }}>
                  COMPLAINT / POLICE REPORT DETAILS
                </span>
                <Field label="FIR or reference?" name="has_fir" value={details.has_fir} onChange={(v) => setDetails({ ...details, has_fir: v })} error={errors.has_fir} />
                <Field label="Reference number" name="reference_number" value={details.reference_number} onChange={(v) => setDetails({ ...details, reference_number: v })} error={errors.reference_number} />
                <Field label="Police station / authority" name="station_authority" value={details.station_authority} onChange={(v) => setDetails({ ...details, station_authority: v })} error={errors.station_authority} />
              </div>
            )}

            {stage === "EXISTING_OLD_CASE" && (
              <div style={{ padding: "2rem 0", borderTop: "1px solid var(--border-hairline)", marginBottom: "2rem" }}>
                <span className="eyebrow-label" style={{ color: "#000000", marginBottom: "1.25rem" }}>
                  EXISTING PROCEEDING DETAILS
                </span>
                <Field label="CNR or case number" name="case_number" value={details.case_number} onChange={(v) => setDetails({ ...details, case_number: v })} error={errors.case_number} />
                <Field label="Court / authority" name="court_authority" value={details.court_authority} onChange={(v) => setDetails({ ...details, court_authority: v })} error={errors.court_authority} />
                <Field label="Current stage" name="current_stage" value={details.current_stage} onChange={(v) => setDetails({ ...details, current_stage: v })} error={errors.current_stage} />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "1.5rem", borderTop: "1px solid var(--border-hairline)" }}>
              <button type="button" className="btn-pill-primary" onClick={nextFromStage}>
                <span>Continue</span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: YOUR STORY (The central experience) */}
        {step === 2 && (
          <div>
            <p style={{ fontSize: "1.05rem", color: "var(--text-body)", marginBottom: "1.75rem" }}>
              In your own words, tell us what took place. Include dates, transactions, agreements, and the remedy you are seeking.
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <textarea
                aria-label="Your story"
                rows="14"
                placeholder="Describe events in chronologic order. Mention specific names, dates, amounts, notices sent, or communications received…"
                value={story}
                onChange={(event) => updateStory(event.target.value)}
                style={{
                  width: "100%",
                  fontSize: "1.1rem",
                  lineHeight: "1.75",
                  padding: "1.5rem",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", color: "var(--text-body)", marginBottom: "2.5rem" }}>
              <span>{story.length} characters · {wordCount} words</span>
              <span className="status-pill status-pill--grey">
                {savingStory ? "Saving draft…" : storySaved ? "Auto-saved to draft" : "Unsaved changes"}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1.5rem", borderTop: "1px solid var(--border-hairline)" }}>
              <button type="button" className="btn-text-link" onClick={() => setStep(1)}>
                <ArrowLeft size={15} />
                <span>Change stage</span>
              </button>
              <button
                type="button"
                className="btn-pill-primary"
                onClick={async () => {
                  await save();
                  setStep(3);
                }}
              >
                <span>Continue</span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: EVIDENCE UPLOAD */}
        {step === 3 && (
          <div>
            <p style={{ fontSize: "1.05rem", color: "var(--text-body)", marginBottom: "2rem" }}>
              Upload contracts, payment receipts, correspondence, or official notices to substantiate your claim.
            </p>

            <div
              style={{
                border: "1px dashed var(--border-subtle)",
                padding: "3rem 2rem",
                textAlign: "center",
                background: "#FFFFFF",
                cursor: "pointer",
                marginBottom: "2rem",
              }}
            >
              <Upload size={28} color="#000000" style={{ margin: "0 auto 1rem" }} />
              <input
                type="file"
                multiple
                data-testid="evidence-input"
                onChange={addEvidence}
                style={{ cursor: "pointer", width: "auto" }}
              />
              <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                PDF, JPG, PNG, DOC, TXT (Maximum 10 MB per file)
              </p>
            </div>

            {message && (
              <div role="alert" style={{ marginBottom: "2rem" }}>
                <span>{message}</span>
              </div>
            )}

            {evidence.length > 0 && (
              <div style={{ marginBottom: "2.5rem" }}>
                <span className="eyebrow-label" style={{ marginBottom: "1rem" }}>
                  ATTACHED FILES ({evidence.length})
                </span>

                <div style={{ borderTop: "1px solid var(--border-hairline)" }}>
                  {evidence.map((item) => (
                    <article
                      key={item.evidence_id}
                      data-testid="evidence-card"
                      style={{
                        padding: "1.25rem 0",
                        borderBottom: "1px solid var(--border-hairline)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span className="status-pill status-pill--grey" style={{ fontWeight: 800 }}>
                            {item.evidence_id}
                          </span>
                          <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#000000" }}>{item.filename}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>({item.size} bytes)</span>
                        </div>
                        <button
                          type="button"
                          className="btn-text-link"
                          style={{ color: "var(--status-crimson)" }}
                          onClick={() => removeEvidence(item.evidence_id)}
                        >
                          Delete
                        </button>
                      </div>

                      <input
                        placeholder="Add document description (e.g. Purchase Invoice from Seller)"
                        aria-label={`Description for ${item.evidence_id}`}
                        value={item.description || ""}
                        onChange={(event) =>
                          setEvidence((current) =>
                            current.map((entry) => (entry.evidence_id === item.evidence_id ? { ...entry, description: event.target.value } : entry))
                          )
                        }
                        onBlur={(event) => changeDescription(item, event.target.value)}
                        style={{ fontSize: "0.9rem", padding: "0.6rem 0.85rem" }}
                      />
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1.5rem", borderTop: "1px solid var(--border-hairline)" }}>
              <button type="button" className="btn-text-link" onClick={() => setStep(2)}>
                <ArrowLeft size={15} />
                <span>Back to story</span>
              </button>
              <button
                type="button"
                className="btn-pill-primary"
                onClick={async () => {
                  await save();
                  setStep(4);
                }}
              >
                <span>Review</span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & SUBMIT */}
        {step === 4 && (
          <div>
            <p style={{ fontSize: "1.05rem", color: "var(--text-body)", marginBottom: "2rem" }}>
              Verify your case details before launching automated statutory intake.
            </p>

            <div style={{ borderTop: "1px solid var(--border-hairline)", marginBottom: "2rem" }}>
              <div style={{ padding: "1.5rem 0", borderBottom: "1px solid var(--border-hairline)" }}>
                <span className="eyebrow-label">PROCEDURAL STAGE</span>
                <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#000000", marginTop: "0.25rem" }}>
                  {currentStage?.title || "Not selected"}
                </p>
              </div>

              <div style={{ padding: "1.5rem 0", borderBottom: "1px solid var(--border-hairline)" }}>
                <span className="eyebrow-label">CLIENT STORY</span>
                <p style={{ marginTop: "0.5rem", whiteSpace: "pre-wrap", fontSize: "1rem", lineHeight: 1.6, color: "var(--text-body)" }}>
                  {story || "No narrative provided."}
                </p>
              </div>

              <div style={{ padding: "1.5rem 0", borderBottom: "1px solid var(--border-hairline)" }}>
                <span className="eyebrow-label">DOCUMENTARY EVIDENCE ({evidence.length})</span>
                {evidence.length === 0 ? (
                  <p style={{ marginTop: "0.35rem", fontSize: "0.95rem", color: "var(--text-muted)" }}>
                    No evidence attached.
                  </p>
                ) : (
                  <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.5rem" }}>
                    {evidence.map((item) => (
                      <div key={item.evidence_id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.92rem" }}>
                        <span className="status-pill status-pill--grey">{item.evidence_id}</span>
                        <span style={{ fontWeight: 600, color: "#000000" }}>{item.filename}</span>
                        {item.description && <span style={{ color: "var(--text-muted)" }}>— {item.description}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {message && (
              <div role="alert" style={{ marginBottom: "2rem" }}>
                <span>{message}</span>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "1.5rem", borderTop: "1px solid var(--border-hairline)" }}>
              <button type="button" className="btn-text-link" onClick={() => setStep(3)}>
                <ArrowLeft size={15} />
                <span>Back to evidence</span>
              </button>
              <button type="button" className="btn-pill-primary" onClick={finish}>
                <span>Submit case</span>
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
