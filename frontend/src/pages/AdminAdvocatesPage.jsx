import { useEffect, useState } from "react";
import { listAdminAdvocates, verifyAdvocate } from "../api";

export default function AdminAdvocatesPage() {
  const [advocates, setAdvocates] = useState([]);
  useEffect(() => { listAdminAdvocates().then((result) => setAdvocates(result.advocates || [])); }, []);
  return <main><h1>Advocate verification</h1>{advocates.map((advocate) => <article key={advocate.id}><p>{advocate.full_name} — {advocate.verification_status}</p><button onClick={() => verifyAdvocate(advocate.id, "VERIFIED")}>Verify</button><button onClick={() => verifyAdvocate(advocate.id, "REJECTED")}>Reject</button></article>)}</main>;
}
