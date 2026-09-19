import { useEffect, useState } from "react";
import { getMe, updateProfile } from "../api";
import FormErrors from "../components/FormErrors";

export default function ProfilePage() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getMe().then((result) => setForm(result.user));
  }, []);

  if (!form) return <main><p>Loading profile…</p></main>;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    setFieldErrors({});
    try {
      const result = await updateProfile({
        full_name: form.full_name,
        mobile_number: form.mobile_number,
        preferred_language: form.preferred_language,
        state: form.state,
        district_city: form.district_city,
      });
      setForm(result.user);
      setSaved(true);
    } catch (requestError) {
      setError(requestError.message);
      setFieldErrors(requestError.fields);
    }
  };

  const editable = ["full_name", "mobile_number", "preferred_language", "state", "district_city"];
  return (
    <main>
      <h1>Your profile</h1>
      <p>Email: <strong>{form.email}</strong></p>
      <p>Role: <strong>{form.role}</strong></p>
      <form onSubmit={submit}>
        {editable.map((name) => (
          <label key={name}>{name.replaceAll("_", " ")}
            <input name={name} value={form[name] || ""} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
            <FormErrors errors={fieldErrors[name]} />
          </label>
        ))}
        {error && <p role="alert">{error}</p>}
        {saved && <p role="status">Profile saved successfully.</p>}
        <button type="submit">Save profile</button>
      </form>
    </main>
  );
}
