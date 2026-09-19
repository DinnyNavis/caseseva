import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { approvePreview2, correctPreview2Fact, getPreview2, resolveDocumentRequest } from "../api";

export default function Preview2Page() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = () => getPreview2(caseId).then(setData);
  useEffect(() => { load(); }, [caseId]);
  if (!data) return <main><p>Loading Preview 2…</p></main>;
  const saveFact = async (factId, text) => {
    await correctPreview2Fact(caseId, factId, text);
    setMessage("Fact corrected; dependent legal stages are rerunning.");
    await load();
  };
  const uploadRequest = async (requestId, event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      await resolveDocumentRequest(caseId, requestId, file);
      setMessage("Document uploaded; affected stages are rerunning.");
      await load();
    } catch (err) { setError(err.message); }
    event.target.value = "";
  };
  const approve = async () => {
    const outstanding = data.document_requests?.filter((item) => !item.resolved) || [];
    const waive = outstanding.length > 0 && window.confirm("Proceed without the outstanding requested document?");
    if (outstanding.length > 0 && !waive) return;
    await approvePreview2(caseId, waive);
    navigate(`/cases/${caseId}`);
  };
  return <main>
    <h1>Preview 2: legal analysis and challenge</h1>
    <p>Please review how the confirmed facts map to law and the objections an opponent may raise.</p>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
    <section data-testid="preview2-domain"><h2>Detected case type</h2><p>{data.domain.domain} — {data.domain.sub_domain}</p><p>{data.domain.reasoning}</p></section>
    {data.forum?.forum_family === "UNSUPPORTED_DOMAIN" && <p role="alert" style={{ background: "#fff3cd", color: "#856404", padding: "12px", borderRadius: "4px" }}>Legal analysis and statutory retrieval for domain '{data.domain?.domain}' is not yet supported. Extracted facts and timeline are available above.</p>}
    <section><h2>Legal issues</h2>{data.issues.map((issue) => <article key={issue.issue_id}><strong>{issue.issue_id}</strong><p>{issue.question}</p><span>Status: {issue.status}</span><p>Facts: {issue.fact_ids.join(", ")} · Evidence: {issue.evidence_ids.join(", ")}</p></article>)}</section>
    <section><h2>The law that applies</h2>{data.verified_provisions.map((item) => <article key={item.provision_id} data-testid="verified-provision"><h3>{item.title}</h3><p>{item.explanation}</p><a href={item.source_url} target="_blank" rel="noreferrer">Official Act text</a></article>)}</section>
    <details><summary>Rejected provisions</summary>{data.rejected_provisions.map((item) => <article key={item.provision_id} data-testid="rejected-provision"><h3>{item.title}</h3><p>{item.explanation}</p><p>Rejected: {(data.citation_verification.decisions || []).find((d) => d.provision_id === item.provision_id)?.reason}</p></article>)}</details>
    <section><h2>Forum and limitation</h2><p data-testid="forum-result">{data.forum.commission_level}: {data.forum.reasoning}</p><p data-testid="limitation-result">{data.limitation.result}: {data.limitation.reasoning}</p></section>
    <section><h2>Evidence coverage</h2>{data.evidence_matrix.map((item) => <article key={item.issue_id}><strong>{item.issue_id}</strong> <span>{item.status}</span><p>{item.note}</p></article>)}</section>
    <section><h2>How this case gets attacked</h2>{(data.arguments.opponent?.objections || []).map((objection) => <article key={objection.objection_id}><h3>{objection.text}</h3><p>{(data.arguments.rebuttal?.rebuttals || []).find((item) => item.objection_id === objection.objection_id)?.response}</p><strong>{(data.arguments.rebuttal?.rebuttals || []).find((item) => item.objection_id === objection.objection_id)?.resolution}</strong></article>)}</section>
    <section><h2>Neutral evaluation</h2><p>Strengths: {data.neutral_evaluation.strengths?.join(" ")}</p><p>Weaknesses: {data.neutral_evaluation.weaknesses?.join(" ")}</p><p>Open risks: {data.neutral_evaluation.unresolved_risks?.join(" ")}</p></section>
    <section><h2>Outstanding document requests</h2>{(data.document_requests || []).filter((item) => !item.resolved).map((item) => <article key={item.request_id} data-testid="document-request"><p>{item.description}</p><input type="file" onChange={(event) => uploadRequest(item.request_id, event)} /></article>)}{!(data.document_requests || []).some((item) => !item.resolved) && <p>No outstanding document requests.</p>}</section>
    <button type="button" onClick={approve}>Approve and continue to advocate review</button>
    {data.status === "PREVIEW_2_APPROVED" && <button type="button" onClick={() => navigate(`/advocates?caseId=${caseId}`)}>Choose an advocate</button>}
  </main>;
}
