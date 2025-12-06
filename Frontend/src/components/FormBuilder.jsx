import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CSS/FormBuilder.css";

export default function FormBuilder() {
  const nav = useNavigate();

  const [bases, setBases] = useState([]);
  const [tables, setTables] = useState([]);
  const [fields, setFields] = useState([]);

  const [baseId, setBaseId] = useState("");
  const [tableId, setTableId] = useState("");
  const [pickedFields, setPickedFields] = useState([]);
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    fetch("/api/auth/airtable/bases", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setBases(d.bases || []))
      .catch(() => (window.location.href = "/"));
  }, []);

  const fetchTables = (id) => {
    fetch(`/api/auth/airtable/tables?base=${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setTables(d.tables || []));
  };

  const changeBase = (e) => {
    const id = e.target.value;
    setBaseId(id);
    setTableId("");
    setFields([]);
    setQuestions([]);
    fetchTables(id);
  };

  const changeTable = (e) => {
    const id = e.target.value;
    setTableId(id);
    const sel = tables.find((t) => t.id === id);
    if (sel) {
      setFields(sel.fields || []);
      setQuestions([]);
    }
  };

  const uid = () => "q_" + Math.random().toString(36).slice(2, 10);

  const toggleField = (field) => {
    const picked = pickedFields.includes(field.id);

    if (picked) {
      setPickedFields((p) => p.filter((x) => x !== field.id));
      setQuestions((p) => p.filter((q) => q.fieldId !== field.id));
    } else {
      setPickedFields((p) => [...p, field.id]);
      setQuestions((p) => [
        ...p,
        {
          questionKey: uid(),
          fieldId: field.id,
          label: field.name,
          name: field.name,
          type: field.type,
          required: false,
          options: field.options || null,
          conditional: null,
        },
      ]);
    }
  };

  const updateQ = (key, patch) => {
    setQuestions((p) => p.map((q) => (q.questionKey === key ? { ...q, ...patch } : q)));
  };

  const saveForm = async () => {
    if (!baseId || !tableId || !questions.length) {
      alert("Select base, table and at least one field");
      return;
    }

    const tableName = tables.find((t) => t.id === tableId)?.name || "";

    const body = {
      baseId,
      tableId,
      tableName,
      fields: questions.map((q) => ({
        id: q.fieldId,
        name: q.name,
        type: q.type,
        options: q.options,
      })),
    };

    const res = await fetch("/api/forms", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.formId) {
      const link = `${window.location.origin}/f/${data.formId}`;
      alert("Form saved. Public link: " + link);
      nav("/dashboard");
    } else {
      alert("Failed to save form");
    }
  };

  return (
    <div className="formbuilder-container">
      <h2>Create Form</h2>

      <div>
        <label>Base</label>
        <select value={baseId} onChange={changeBase}>
          <option value="">Select Base</option>
          {bases.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Table</label>
        <select value={tableId} onChange={changeTable}>
          <option value="">Select Table</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="fields-list">
        <h4>Available Fields</h4>
        {fields.map((f) => (
          <label key={f.id} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={pickedFields.includes(f.id)}
              onChange={() => toggleField(f)}
            />
            {f.name} — {f.type}
          </label>
        ))}
      </div>

      {questions.length > 0 && (
        <div className="question-box">
          <h4>Configure Questions</h4>

          {questions.map((q) => {
            const cond = q.conditional?.conditions?.[0] || {};

            return (
              <div
                key={q.questionKey}
                style={{ border: "1px solid #eee", padding: 8, marginBottom: 8 }}
              >
                <div>
                  <label>Label: </label>
                  <input
                    value={q.label}
                    onChange={(e) => updateQ(q.questionKey, { label: e.target.value })}
                  />
                </div>

                <div>
                  <label>Required: </label>
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) =>
                      updateQ(q.questionKey, { required: e.target.checked })
                    }
                  />
                </div>

                <div>
                  <label>Conditional (show if): </label>

                  <select
                    value={cond.questionKey || ""}
                    onChange={(e) =>
                      updateQ(q.questionKey, {
                        conditional: {
                          logic: "AND",
                          conditions: [
                            { ...cond, questionKey: e.target.value },
                          ],
                        },
                      })
                    }
                  >
                    <option value="">--none--</option>
                    {questions
                      .filter((qq) => qq.questionKey !== q.questionKey)
                      .map((qq) => (
                        <option key={qq.questionKey} value={qq.questionKey}>
                          {qq.label}
                        </option>
                      ))}
                  </select>

                  <select
                    value={cond.operator || ""}
                    onChange={(e) =>
                      updateQ(q.questionKey, {
                        conditional: {
                          logic: "AND",
                          conditions: [
                            { ...cond, operator: e.target.value },
                          ],
                        },
                      })
                    }
                  >
                    <option value="equals">equals</option>
                    <option value="notEquals">not equals</option>
                    <option value="contains">contains</option>
                  </select>

                  <input
                    value={cond.value || ""}
                    placeholder="value"
                    onChange={(e) =>
                      updateQ(q.questionKey, {
                        conditional: {
                          logic: "AND",
                          conditions: [
                            { ...cond, value: e.target.value },
                          ],
                        },
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="save-btn" onClick={saveForm}>
        Save & Get Public Link
      </button>
    </div>
  );
}
