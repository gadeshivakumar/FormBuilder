import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CSS/Dashboard.css";
import { API } from "../utils/config";
function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [navigator,useNavigator]=useNavigate();
  useEffect(() => {
  const load = () => {
    fetch(`${API}/auth/airtable/profile`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setProfile(data))
      .catch((err) => {
        console.log("err");
        navigator("/");
      });
  };

  load();
}, []);


  useEffect(() => {
    if (!profile?.id) return <p>Loading...</p>;

    fetch(`${API}/search/forms?owner=${profile.id}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((d) => setForms(d.forms || []))
      .catch(() => setForms([]))
      .finally(() => setLoading(false));
  }, [profile]);

  const createForm = () => navigate("/form-builder");

  const copyFormLink = (url) => {
    navigator.clipboard.writeText(url);
    alert("Copied!");
  };

  const openResponses = (id) => navigate(`/forms/${id}/responses/`);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="dashboard-container">
      <div className="profile-box">
        <h2>Your Profile</h2>
        {profile ? (
          <>
            <p>User ID: {profile.id}</p>
            <p>Scopes: {profile.scopes?.join(", ")}</p>
          </>
        ) : (
          <p>Failed to load profile</p>
        )}
      </div>

      <div className="create-form-box">
        <button className="btn" onClick={createForm}>
          ➕ Create New Form
        </button>
      </div>

      <div className="forms-list">
        <h2>Your Forms</h2>

        {!forms.length && <p>No forms created yet.</p>}

        {forms.map((f) => {
          const url = `https://form-builder-pearl-one.vercel.app/f/${f._id}`;
          return (
            <div key={f._id} className="form-item">
              <p>
                <strong>{f.tableName}</strong>
              </p>

              <div className="form-actions">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-small"
                >
                  Open Form
                </a>

                <button className="btn-small" onClick={() => copyFormLink(url)}>
                  Copy Link
                </button>

                <button
                  className="btn-small secondary"
                  onClick={() => openResponses(f._id)}
                >
                  📄 Responses
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Dashboard;
