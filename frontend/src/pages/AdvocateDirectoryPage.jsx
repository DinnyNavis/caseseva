import { useEffect, useState } from "react";
import { listAdvocates, requestAdvocate } from "../api";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function AdvocateDirectoryPage() {
  const [advocates, setAdvocates] = useState([]);
  const [search, setSearch] = useSearchParams();
  const navigate = useNavigate();
  const caseId = search.get("caseId");
  const load = () => listAdvocates({ domain: search.get("domain") || "", state: search.get("state") || "", language: search.get("language") || "" }).then((result) => setAdvocates(result.advocates));
  useEffect(() => { load(); }, [search]);
  const choose = async (id) => { if (caseId) { await requestAdvocate(caseId, id); navigate(`/cases/${caseId}`); } };
  return <main><h1>Verified advocate directory</h1>
    <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); setSearch({ caseId: caseId || "", domain: data.get("domain"), state: data.get("state"), language: data.get("language") }); }}>
      <input name="domain" placeholder="Practice domain" defaultValue={search.get("domain") || ""} /><input name="state" placeholder="State" defaultValue={search.get("state") || ""} /><input name="language" placeholder="Language" defaultValue={search.get("language") || ""} /><button>Filter</button>
    </form>
    {advocates.map((advocate) => <article key={advocate.id} data-testid="advocate-card"><h2>{advocate.full_name}</h2><p>{advocate.bar_council} · {advocate.place_of_practice}</p><p>{advocate.practice_domains?.join(", ")} · {advocate.languages?.join(", ")}</p>{caseId && <button onClick={() => choose(advocate.id)}>Request advocate</button>}</article>)}
  </main>;
}
