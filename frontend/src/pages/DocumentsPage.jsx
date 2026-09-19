import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { documentDownloadUrl, getDocument, listDocuments, overrideDocumentConsistency } from "../api";

export default function DocumentsPage() {
  const { caseId } = useParams();
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [user, setUser] = useState(null);
  const load = () => listDocuments(caseId).then((result) => setDocuments(result.documents));
  useEffect(() => { load(); }, [caseId]);
  const view = (id) => getDocument(caseId, id).then((result) => setSelected(result.document));
  const isAdvocate = user?.role === "advocate";
  useEffect(() => { import("../api").then(({ getMe }) => getMe().then((result) => setUser(result.user))); }, []);
  if (!documents) return <main><p>Loading documents…</p></main>;
  return <main>
    <h1>Generated documents</h1>
    <p>Approved-record exports. Earlier versions remain available for comparison.</p>
    <section data-testid="document-list">{documents.map((doc) => {
      const failed = doc.consistency?.some((finding) => finding.result === "FAIL");
      return <article key={doc.id}><h2>{doc.type === "report" ? "Case Intelligence Report" : "Consumer Complaint Draft"} — v{doc.version}</h2>
        <p>{new Date(doc.created_at).toLocaleString()} · <strong data-testid="consistency-status">{failed ? "FAIL" : "PASS"}</strong></p>
        <button type="button" onClick={() => view(doc.id)}>View</button>
        <a href={documentDownloadUrl(caseId, doc.id)} target="_blank" rel="noreferrer">Download</a>
        {isAdvocate && failed && <button type="button" onClick={async () => { const reason = window.prompt("Override reason"); if (reason) { await overrideDocumentConsistency(caseId, doc.id, reason); load(); } }}>Override consistency</button>}
      </article>;
    })}</section>
    {selected && <section data-testid="document-viewer"><h2>Version {selected.version}</h2><button type="button" onClick={() => window.print()}>Print</button><article className="document-content" dangerouslySetInnerHTML={{ __html: selected.html.replaceAll("[TO BE COMPLETED:", "<mark>[TO BE COMPLETED:") }} /></section>}
  </main>;
}
