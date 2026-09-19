import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { setToken, signup } from "../api";
import FormErrors from "../components/FormErrors";

const initial = {
  full_name: "", email: "", mobile_number: "", password: "",
  preferred_language: "English", state: "", district_city: "",
  role: "client", bar_council: "", enrolment_number: "", enrolment_year: "",
  place_of_practice: "", court_region: "", practice_domains: ["Consumer"], languages: ["English"],
};

export default function SignupPage() {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    const clientErrors = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) clientErrors.email = "Enter a valid email address.";
    if (!/^[6-9]\d{9}$/.test(form.mobile_number.trim())) clientErrors.mobile_number = "Enter a valid 10-digit Indian mobile number.";
    if (form.password.length < 8) clientErrors.password = "Password must be at least 8 characters.";
    if (Object.keys(clientErrors).length) {
      setFieldErrors(clientErrors);
      setError("Please fix the highlighted fields.");
      return;
    }
    try {
      const payload = form.role === "advocate"
        ? { ...form, enrolment_year: Number(form.enrolment_year), practice_domains: Array.isArray(form.practice_domains) ? form.practice_domains : form.practice_domains.split(",").map((item) => item.trim()).filter(Boolean), languages: Array.isArray(form.languages) ? form.languages : form.languages.split(",").map((item) => item.trim()).filter(Boolean) }
        : Object.fromEntries(Object.entries(form).filter(([key]) => !["bar_council", "enrolment_number", "enrolment_year", "place_of_practice", "court_region", "practice_domains", "languages"].includes(key)));
      const result = await signup(payload);
      setToken(result.session_token);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      setFieldErrors(requestError.fields);
    }
  };

  const field = (name, label, type = "text") => (
    <label key={name}>{label}
      <input name={name} type={type} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
      <FormErrors errors={fieldErrors[name]} />
    </label>
  );

  return (
    <main>
      <h1>Create your client account</h1>
      <form onSubmit={submit} noValidate>
        <label>Account type<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="client">Client</option><option value="advocate">Advocate</option></select></label>
        {field("full_name", "Full name")}
        {field("email", "Email", "email")}
        {field("mobile_number", "Mobile number")}
        {field("password", "Password", "password")}
        {field("preferred_language", "Preferred language")}
        {field("state", "State")}
        {field("district_city", "District / city")}
        {form.role === "advocate" && <>
          {field("bar_council", "State Bar Council")}
          {field("enrolment_number", "Enrolment / bar registration number")}
          {field("enrolment_year", "Enrolment year", "number")}
          {field("place_of_practice", "Ordinary place of practice")}
          {field("court_region", "Court / region")}
          {field("practice_domains", "Practice domains")}
          {field("languages", "Languages")}
        </>}
        {error && <p role="alert">{error}</p>}
        <button type="submit">Create account</button>
      </form>
      <p>Already registered? <Link to="/login">Log in</Link></p>
    </main>
  );
}
