import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { shouldShowQuestion } from "../utils/logic";
import "./CSS/FormViewer.css";

const readFiles = (files) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(files);
  });

function FieldInput({ q, value, onChange }) {
  const t = (q.type || "").toLowerCase();

  if (t.includes("singleselect")) {
    const opts = q.options?.choices || [];
    return (
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {opts.map((o) => (
          <option key={o.name} value={o.name}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }

  if (t.includes("multipleselect")) {
    const opts = q.options?.choices || [];
    const chosen = value || [];

    const handle = (x) => {
      if (chosen.includes(x)) {
        onChange(chosen.filter((v) => v !== x));
      } else {
        onChange([...chosen, x]);
      }
    };

    return (
      <div>
        {opts.map((o) => (
          <label key={o.name} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={chosen.includes(o.name)}
              onChange={() => handle(o.name)}
            />
            {o.name}
          </label>
        ))}
      </div>
    );
  }

  if (t.includes("number")) {
    return (
      <input
        type="number"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (t.includes("multiline") || t.includes("longtext")) {
    return (
      <textarea
        rows={4}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (t.includes("attachment")) {
    const handleFile = async (e) => {
      const arr = Array.from(e.target.files);
      try {
        onChange(arr);
      } catch {
        alert("Could not read file");
      }
    };
    return <input type="file" multiple onChange={handleFile} />;
  }

  return (
    <input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function FormViewer() {
  const { id } = useParams();
  const [form, setForm] = useState(null);
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch(`/api/forms/${id}`,{credentials:"include"})
      .then((r) => r.json())
      .then((d) => setForm(d))
      .catch(() => setForm(null));
  }, [id]);

  const updateAns = (k, v) => {
    setAnswers((p) => ({ ...p, [k]: v }));
  };

  const submit = async () => {
    if (!form) return;

    for (const q of form.questions) {
      if (!shouldShowQuestion(q.conditional, answers)) continue;
      const val = answers[q.questionKey];
      if (q.required && (val === "" || val === undefined || (Array.isArray(val) && val.length === 0))) {
        alert(`Please fill ${q.label}`);
        return;
      }
    }

    setStatus("Submitting...");

    const r = await fetch(`/api/forms/${id}/submit`, {
      method: "POST",
      credentials:"include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });

    const out = await r.json();
    if (out.ok) {
      setStatus("Submitted successfully!");
      setAnswers({});
    } else {
      setStatus("Failed to submit");
    }
  };

  if (!form) return <div>Loading form...</div>;

  return (
    <div className="formviewer-container">
      <h2>Form: {form.tableName}</h2>

      {form.questions.map((q) => {
        const show = shouldShowQuestion(q.conditional, answers);
        if (!show) return null;

        return (
          <div key={q.questionKey} className="form-question">
            <label style={{ display: "block", marginBottom: 4 }}>
              {q.label} {q.required ? "*" : ""}
            </label>

            <FieldInput
              q={q}
              value={answers[q.questionKey]}
              onChange={(v) => updateAns(q.questionKey, v)}
            />
          </div>
        );
      })}

      <button className="submit-btn" onClick={submit}>
        Submit
      </button>

      {status && <div className="status-text">{status}</div>}
    </div>
  );
}
