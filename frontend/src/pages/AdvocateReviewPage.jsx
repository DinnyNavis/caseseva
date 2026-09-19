import { useEffect, useState } from "react";
import { approveAdvocateFact, finalizeAdvocateCase, getAdvocateCase, removeAdvocateProvision, saveAdvocateNote } from "../api";
import { useParams } from "react-router-dom";

export default function AdvocateReviewPage() {
  const { caseId } = useParams();
  const [item, setItem] = useState(null);
  const [note, setNote] = useState("");
  const load = () => getAdvocateCase(caseId).then((result) => { setItem(result.case); setNote(result.case.advocate_review_note || ""); });
  useEffect(() => { load(); }, [caseId]);
  if (!item) return <main><p>Loading advocate workspace…</p></main>;
  const approved = item.advocate_approved_items || [];
  const removed = item.advocate_removed_items || [];
  const total = (item.facts || []).filter((x) => !x.removed).length + (item.verified_legal_sections || []).filter((x) => !x.removed).length;
  const done = approved.length + removed.length;
  return <main><h1>Advocate review workspace</h1><section data-testid="review-summary">Approved: {done} · Outstanding: {Math.max(total - done, 0)}</section>
    <section><h2>Facts</h2>{item.facts?.filter((x) => !x.removed).map((fact) => <article key={fact.fact_id}><strong>{fact.fact_id}</strong><p>{fact.text}</p><button onClick={async () => { await approveAdvocateFact(caseId, fact.fact_id); load(); }}>Approve</button></article>)}</section>
    <section><h2>Legal provisions</h2>{item.verified_legal_sections?.filter((x) => !x.removed).map((provision) => <article key={provision.provision_id}><h3>{provision.title}</h3><p>{provision.explanation}</p><a href={provision.source_url} target="_blank" rel="noreferrer">Official Act text</a><button onClick={async () => { const result = await removeAdvocateProvision(caseId, provision.provision_id); setItem(result.case); }}>Remove this ground</button></article>)}</section>
    <section><h2>Arguments</h2>{item.arguments?.opponent?.objections?.map((objection) => <article key={objection.objection_id}><p>{objection.text}</p><p>{item.arguments?.rebuttal?.rebuttals?.find((x) => x.objection_id === objection.objection_id)?.response}</p></article>)}</section>
    <section><h2>Review note</h2><textarea value={note} onChange={(event) => setNote(event.target.value)} /><button onClick={async () => { await saveAdvocateNote(caseId, note); load(); }}>Save note</button></section>
    <button onClick={async () => { await finalizeAdvocateCase(caseId); load(); }}>Finalize review</button>
  </main>;
}
