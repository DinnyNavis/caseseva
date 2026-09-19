import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCase, getCaseStatus, retryAnalysis, startAnalysis, startLegalAnalysis } from "../api";
import { generateDocuments } from "../api";

const stageNames = ["INTAKE", "FACT_EXTRACTION", "TIMELINE_CONSTRUCTION", "PARTY_IDENTIFICATION"];

export default function CaseDetailPage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => getCase(caseId).then((result) => setItem(result.case));
  useEffect(() => { refresh(); }, [caseId]);
  useEffect(() => {
    if (!item || !["ANALYZING", "ANALYSIS_FAILED", "LEGAL_ANALYSIS_RUNNING", "LEGAL_ANALYSIS_FAILED"].includes(item.status)) return;
    const timer = setInterval(() => getCaseStatus(caseId).then((result) => {
      setStatus(result);
      if (!["ANALYZING", "LEGAL_ANALYSIS_RUNNING"].includes(result.status)) refresh();
    }), 250);
    return () => clearInterval(timer);
  }, [item?.status, caseId]);
  if (!item) return <main><p>Loading case…</p></main>;
  const begin = async () => { setBusy(true); await startAnalysis(caseId); setBusy(false); setStatus(await getCaseStatus(caseId)); refresh(); };
  const retry = async () => { setBusy(true); await retryAnalysis(caseId); setBusy(false); refresh(); };
  const beginLegal = async () => { setBusy(true); await startLegalAnalysis(caseId); setBusy(false); setStatus(await getCaseStatus(caseId)); refresh(); };
  const beginDocuments = async () => { setBusy(true); await generateDocuments(caseId); setBusy(false); navigate(`/cases/${caseId}/documents`); };
  return <main>
    <h1>Case details</h1><p data-testid="case-status">Status: {item.status}</p>
    <p>Stage: {item.stage || "Not selected"}</p><p>{item.client_story || "No story yet."}</p>
    <h2>Evidence</h2>{item.evidence.map((entry) => <p key={entry.evidence_id}>{entry.evidence_id}: {entry.filename}</p>)}
    {item.status === "DRAFT" && <a href={`/cases/${caseId}/edit`}>Continue editing</a>}
    {item.status === "READY_FOR_ANALYSIS" && <button type="button" onClick={begin} disabled={busy}>Start analysis</button>}
    {item.status === "READY_FOR_ANALYSIS" && <section data-testid="analysis-placeholder"><h2>Analysis</h2><p>Analysis has not started yet.</p></section>}
    {item.status === "ANALYZING" && <section data-testid="analysis-progress"><h2>Analysis progress</h2>{stageNames.map((name) => <p key={name}>{name}: {(status?.stage_statuses || item.stage_statuses)[name] || "WAITING"}</p>)}</section>}
    {item.status === "ANALYSIS_FAILED" && <section><p role="alert">Analysis failed at {item.analysis_error?.stage}: {item.analysis_error?.message}</p><button type="button" onClick={retry}>Retry failed stages</button></section>}
    {item.status === "AWAITING_PREVIEW_1" && <button type="button" onClick={() => navigate(`/cases/${caseId}/preview1`)}>Review Preview 1</button>}
    {item.status === "PREVIEW_1_APPROVED" && <button type="button" onClick={beginLegal} disabled={busy}>Start legal analysis</button>}
    {item.status === "LEGAL_ANALYSIS_RUNNING" && <section data-testid="legal-analysis-progress"><h2>Legal analysis progress</h2>{Object.entries(status?.stage_statuses || item.stage_statuses).filter(([name]) => name !== "INTAKE" && name !== "FACT_EXTRACTION" && name !== "TIMELINE_CONSTRUCTION" && name !== "PARTY_IDENTIFICATION").map(([name, value]) => <p key={name}>{name}: {value}</p>)}</section>}
    {item.status === "AWAITING_PREVIEW_2" && <button type="button" onClick={() => navigate(`/cases/${caseId}/preview2`)}>Review Preview 2</button>}
    {item.status === "NEEDS_DOCUMENT" && <button type="button" onClick={() => navigate(`/cases/${caseId}/preview2`)}>Review document request</button>}
    {item.status === "LEGAL_ANALYSIS_FAILED" && <section><p role="alert">Legal analysis failed at {item.legal_analysis_error?.stage}: {item.legal_analysis_error?.message}</p></section>}
    {item.status === "ADVOCATE_APPROVED" && <button type="button" onClick={beginDocuments} disabled={busy}>Generate documents</button>}
    {["DOCUMENTS_READY", "DOCUMENTS_BLOCKED"].includes(item.status) && <button type="button" onClick={() => navigate(`/cases/${caseId}/documents`)}>View documents</button>}
    {item.status === "PREVIEW_1_APPROVED" && <section data-testid="analysis-placeholder"><h2>Legal analysis</h2><p>Legal analysis will appear in Part 5.</p></section>}
  </main>;
}
