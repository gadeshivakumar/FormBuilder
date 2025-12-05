import React from "react";
import "./CSS/Landing.css";

const Landing = () => {
  const handleLogin = () => {
    window.location.href = "http://localhost:5000/auth/airtable/start";
  };

  return (
    <div className="landing-container">
      <h1 className="landing-title">Welcome to Form Builder App</h1>

      <button className="landing-button" onClick={handleLogin}>
        Login with Airtable
      </button>
    </div>
  );
};

export default Landing;
