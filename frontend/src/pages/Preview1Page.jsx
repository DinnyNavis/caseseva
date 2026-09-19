import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addFact, approvePreview1, editFact, editParties, editTimeline, getPreview1, rerunPreview1, uploadEvidence } from "../api";

export default function Preview1Page() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [newFact, setNewFact] = useState("");
  const [saved, setSaved] = useState("");
  const [uploadError, setUploadError] = useState("");
  const load = () => getPreview1(caseId).then(setData);
  useEffect(() => { load(); }, [caseId]);
  if (!data) return <main><p>Loading Preview 1…</p></main>;
  const save = async (action) => { await action(); setSaved("Saved"); await load(); };
  const approve = async () => { if (window.confirm("Confirm that you have reviewed the facts, timeline, and parties?")) { await approvePreview1(caseId); navigate(`/cases/${caseId}`); } };
  const upload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadError("");
    try {
      await uploadEvidence(caseId, file);
      await rerunPreview1(caseId);
      setSaved("Evidence uploaded; fact and timeline extraction rerunning.");
      await new Promise((resolve) => setTimeout(resolve, 500));
      await load();
    } catch (error) {
      setUploadError(error.message);
    }
    event.target.value = "";
  };
  return <main>
    <h1>Preview 1: confirm what we understood</h1><p>Please correct anything wrong before we analyse the law.</p>{saved && <p role="status">{saved}</p>}
    <section><h2>Add evidence</h2><input type="file" onChange={upload} /><p>Additional evidence can be added while reviewing.</p>{uploadError && <p role="alert">{uploadError}</p>}</section>
    <section><h2>Facts</h2>{data.facts.map((fact) => <article key={fact.fact_id} data-testid="fact-card"><strong>{fact.fact_id}</strong><input aria-label={`Fact ${fact.fact_id}`} value={fact.text} onChange={(e) => setData({ ...data, facts: data.facts.map((f) => f.fact_id === fact.fact_id ? { ...f, text: e.target.value } : f) })} onBlur={(e) => save(() => editFact(caseId, fact.fact_id, { text: e.target.value }))} /><span>{fact.evidence.map((e) => <button type="button" key={e.evidence_id}>{e.filename}</button>)}</span><button type="button" onClick={() => save(() => editFact(caseId, fact.fact_id, { removed: true }))}>Remove</button></article>)}<input aria-label="Add a fact we missed" value={newFact} onChange={(e) => setNewFact(e.target.value)} /><button type="button" onClick={() => save(async () => { await addFact(caseId, { text: newFact }); setNewFact(""); })}>Add a fact we missed</button></section>
    <section><h2>Timeline</h2>{data.timeline.map((event) => <article key={event.event_id} data-testid="timeline-event"><strong>{event.event_id}</strong><input aria-label={`Date ${event.event_id}`} value={event.date} onChange={(e) => setData({ ...data, timeline: data.timeline.map((t) => t.event_id === event.event_id ? { ...t, date: e.target.value } : t) })} onBlur={(e) => save(() => editTimeline(caseId, event.event_id, { date: e.target.value }))} /><span>{event.description}</span></article>)}</section>
    <section><h2>Parties</h2>{data.parties && <><input aria-label="Client role" value={data.parties.client_role} onChange={(e) => setData({ ...data, parties: { ...data.parties, client_role: e.target.value } })} /><input aria-label="Opposite party" value={data.parties.opposite_party} onChange={(e) => setData({ ...data, parties: { ...data.parties, opposite_party: e.target.value } })} /><input aria-label="Relationship" value={data.parties.relationship} onChange={(e) => setData({ ...data, parties: { ...data.parties, relationship: e.target.value } })} /><button type="button" onClick={() => save(() => editParties(caseId, data.parties))}>Save parties</button></>}</section>
    <button type="button" onClick={approve}>Approve and continue</button>
  </main>;
}
