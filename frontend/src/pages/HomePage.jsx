import { useEffect, useState } from "react";
import { getHealth } from "../api";

export default function HomePage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getHealth().then(setHealth).catch((requestError) => {
      setError(requestError.message);
    });
  }, []);

  return (
    <main>
      <h1>CaseSeva.ai</h1>
      <p>Legal case intelligence for everyone.</p>
      {health && (
        <p data-testid="health-status">
          Backend status: {health.status} | Adapter mode: {health.adapter_mode}
        </p>
      )}
      {error && <p role="alert">Unable to reach backend: {error}</p>}
    </main>
  );
}
