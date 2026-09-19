import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, setToken } from "../api";
import FormErrors from "../components/FormErrors";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    try {
      const result = await login(form);
      setToken(result.session_token);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      setFieldErrors(requestError.fields);
    }
  };

  return (
    <main>
      <h1>Log in to CaseSeva.ai</h1>
      <form onSubmit={submit}>
        <label>Email<input name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <FormErrors errors={fieldErrors.email} />
        <label>Password<input name="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <FormErrors errors={fieldErrors.password} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Log in</button>
      </form>
      <p>New to CaseSeva.ai? <Link to="/signup">Create an account</Link></p>
    </main>
  );
}
