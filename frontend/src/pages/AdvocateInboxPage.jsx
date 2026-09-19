import { useEffect, useState } from "react";
import { acceptAdvocateRequest, declineAdvocateRequest, getAdvocateRequests } from "../api";
import { Link } from "react-router-dom";

export default function AdvocateInboxPage() {
  const [requests, setRequests] = useState([]);
  const load = () => getAdvocateRequests().then((result) => setRequests(result.requests));
  useEffect(() => { load(); }, []);
  return <main><h1>Advocate case inbox</h1>{requests.map((item) => <article key={item.case_id} data-testid="advocate-request"><p>{item.domain} · {item.sub_domain}</p><p>{item.forum_level} · {item.evidence_count} evidence files · {item.unresolved_risks_count} risks</p><button onClick={async () => { await acceptAdvocateRequest(item.case_id); load(); }}>Accept</button><button onClick={async () => { await declineAdvocateRequest(item.case_id); load(); }}>Decline</button></article>)}<Link to="/advocate/review">Review workspace</Link></main>;
}
