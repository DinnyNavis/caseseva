import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createCase, deleteEvidence, getCase, submitCase, updateCase, updateEvidence, uploadEvidence,
} from "../api";

const STAGES = [
  { id: "NEW_CONSULTATION", title: "New / Consultation", text: "No formal proceeding exists yet." },
  { id: "COMPLAINT_FIR", title: "Complaint / FIR exists", text: "A police or authority step has already happened." },
  { id: "EXISTING_OLD_CASE", title: "Existing / Old case", text: "A case is already pending or decided." },
];
const emptyDetails = { has_fir: "", reference_number: "", station_authority: "", case_number: "", court_authority: "", current_stage: "" };

function Field({ label, name, value, onChange, error }) {
  return <label>{label}<input name={name} value={value || ""} onChange={(event) => onChange(event.target.value)} />{error && <span className="field-error">{error}</span>}</label>;
}

export default function CaseCreatePage() {
  const { caseId: routeCaseId } = useParams();
  const initialized = useRef(false);
  const [caseId, setCaseId] = useState(null);
  const [stage, setStage] = useState("");
  const [details, setDetails] = useState(emptyDetails);
  const [story, setStory] = useState("");
  const [evidence, setEvidence] = useState([]);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (routeCaseId) {
      getCase(routeCaseId).then((result) => {
        const item = result.case;
        setCaseId(item.case_id); setStage(item.stage || ""); setDetails(item.stage_details || emptyDetails);
        setStory(item.client_story || ""); setEvidence(item.evidence || []); setStep(1);
      });
      return;
    }
    const saved = window.localStorage.getItem("caseseva_draft_case");
    if (saved) {
      const parsed = JSON.parse(saved);
      setCaseId(parsed.caseId); setStage(parsed.stage || ""); setDetails(parsed.details || emptyDetails);
      setStory(parsed.story || ""); setEvidence(parsed.evidence || []); setStep(parsed.step || 1);
      return;
    }
    createCase().then((result) => {
      setCaseId(result.case.case_id);
      window.localStorage.setItem("caseseva_draft_case", JSON.stringify({ caseId: result.case.case_id, step: 1 }));
    });
  }, [routeCaseId]);

  useEffect(() => {
    if (caseId) {
      window.localStorage.setItem("caseseva_draft_case", JSON.stringify({ caseId, stage, details, story, evidence, step }));
    }
  }, [caseId, stage, details, story, evidence, step]);

  const save = async (next = {}) => {
    const payload = { stage: next.stage ?? stage, stage_details: next.details ?? details, client_story: next.story ?? story };
    const result = await updateCase(caseId, payload);
    setErrors({});
    return result.case;
  };

  const chooseStage = async (nextStage) => {
    setStage(nextStage);
    setDetails(emptyDetails);
    setErrors({});
  };

  const nextFromStage = async () => {
    setStep(2);
    try {
      await save();
    } catch (error) {
      setStep(1);
      setErrors(error.fields || {});
    }
  };

  const updateStory = async (value) => {
    setStory(value);
    if (caseId) {
      try { await updateCase(caseId, { client_story: value, stage, stage_details: details }); } catch {}
    }
  };

  const addEvidence = async (event) => {
    setMessage("");
    for (const file of Array.from(event.target.files || [])) {
      try {
        const result = await uploadEvidence(caseId, file);
        setEvidence((current) => [...current, result.evidence]);
      } catch (error) {
        setMessage(error.message);
      }
    }
    event.target.value = "";
  };

  const removeEvidence = async (id) => {
    await deleteEvidence(caseId, id);
    setEvidence((current) => current.filter((item) => item.evidence_id !== id));
  };

  const changeDescription = async (item, description) => {
    setEvidence((current) => current.map((entry) => entry.evidence_id === item.evidence_id ? { ...entry, description } : entry));
    await updateEvidence(caseId, item.evidence_id, description);
  };

  const finish = async () => {
    try {
      await save();
      const result = await submitCase(caseId);
      window.localStorage.removeItem("caseseva_draft_case");
      navigate(`/cases/${result.case.case_id}`);
    } catch (error) {
      setErrors(error.fields || {});
      const details = Object.values(error.fields || {}).join(" ");
      setMessage([error.message, details].filter(Boolean).join(" "));
    }
  };

  if (!caseId) return <main><p>Preparing your case…</p></main>;
  const currentStage = STAGES.find((item) => item.id === stage);
  return (
    <main>
      <h1>Create a case</h1>
      <p data-testid="progress">Step {step} of 4</p>
      {step === 1 && <>
        <h2>What stage is your case in?</h2>
        {STAGES.map((item) => <button type="button" key={item.id} data-testid={`stage-${item.id}`} onClick={() => chooseStage(item.id)}>{item.title}<small>{item.text}</small></button>)}
        {stage === "COMPLAINT_FIR" && <section>
          <Field label="FIR or reference?" name="has_fir" value={details.has_fir} onChange={(value) => setDetails({ ...details, has_fir: value })} error={errors.has_fir} />
          <Field label="Reference number" name="reference_number" value={details.reference_number} onChange={(value) => setDetails({ ...details, reference_number: value })} error={errors.reference_number} />
          <Field label="Police station / authority" name="station_authority" value={details.station_authority} onChange={(value) => setDetails({ ...details, station_authority: value })} error={errors.station_authority} />
        </section>}
        {stage === "EXISTING_OLD_CASE" && <section>
          <Field label="CNR or case number" name="case_number" value={details.case_number} onChange={(value) => setDetails({ ...details, case_number: value })} error={errors.case_number} />
          <Field label="Court / authority" name="court_authority" value={details.court_authority} onChange={(value) => setDetails({ ...details, court_authority: value })} error={errors.court_authority} />
          <Field label="Current stage" name="current_stage" value={details.current_stage} onChange={(value) => setDetails({ ...details, current_stage: value })} error={errors.current_stage} />
        </section>}
        <button type="button" onClick={nextFromStage}>Continue</button>
      </>}
      {step === 2 && <>
        <h2>Tell your story</h2>
        <textarea aria-label="Your story" rows="12" placeholder="What happened, when, who was involved, and what do you want?" value={story} onChange={(event) => updateStory(event.target.value)} />
        <p>{story.length} characters · {story.trim() ? story.trim().split(/\s+/).length : 0} words</p>
        <button type="button" onClick={() => setStep(1)}>Back</button><button type="button" onClick={() => setStep(3)}>Continue</button>
      </>}
      {step === 3 && <>
        <h2>Upload evidence</h2>
        <p>You can add more evidence later too.</p>
        <input type="file" multiple data-testid="evidence-input" onChange={addEvidence} />
        {message && <p role="alert">{message}</p>}
        {evidence.map((item) => <article key={item.evidence_id} data-testid="evidence-card"><strong>{item.evidence_id}</strong> {item.filename} ({item.size} bytes)<input aria-label={`Description for ${item.evidence_id}`} value={item.description || ""} onChange={(event) => setEvidence((current) => current.map((entry) => entry.evidence_id === item.evidence_id ? { ...entry, description: event.target.value } : entry))} onBlur={(event) => changeDescription(item, event.target.value)} /><button type="button" onClick={() => removeEvidence(item.evidence_id)}>Delete</button></article>)}
        <button type="button" onClick={() => setStep(2)}>Back</button><button type="button" onClick={() => setStep(4)}>Review</button>
      </>}
      {step === 4 && <>
        <h2>Review and submit</h2>
        <p>Stage: {currentStage?.title}</p><p>{story}</p>
        {evidence.map((item) => <p key={item.evidence_id}>{item.evidence_id}: {item.filename}</p>)}
        {message && <p role="alert">{message}</p>}
        <button type="button" onClick={() => setStep(3)}>Back</button><button type="button" onClick={finish}>Submit case</button>
      </>}
    </main>
  );
}
