export default function FormErrors({ errors }) {
  return errors ? <span className="field-error">{errors}</span> : null;
}
