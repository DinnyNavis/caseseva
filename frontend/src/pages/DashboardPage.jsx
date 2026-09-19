import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMe, listCases } from "../api";

export default function DashboardPage() {
  const [cases, setCases] = useState(null);
  const [user, setUser] = useState(null);
  useEffect(() => {
    getMe().then((result) => setUser(result.user));
    listCases().then((result) => setCases(result.cases));
  }, []);
  return (
    <main>
      <h1 data-testid="dashboard-heading">Welcome{user ? `, ${user.full_name}` : ""}</h1>
      <Link to="/cases/new"><button type="button">Start a new case</button></Link>
      {cases?.length === 0 && <p data-testid="empty-cases">You have not created a case yet.</p>}
      <section data-testid="your-cases"><h2>Your cases</h2>
      <div data-testid="case-list">
        {cases?.map((item) => (
          <article key={item.case_id} data-testid="case-card">
            <Link to={`/cases/${item.case_id}`}><h2>{item.title}</h2></Link>
            <p>{item.preview || "No story yet."}</p>
            <span>{item.status}</span>
          </article>
        ))}
      </div>
      </section>
    </main>
  );
}
