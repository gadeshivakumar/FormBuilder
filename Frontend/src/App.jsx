import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";
import FormBuilder from "./components/FormBuilder";
import FormViewer from "./components/FormViewer";
import Responses from "./components/Responses";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/form-builder" element={<FormBuilder />} />
        <Route path="/f/:id" element={<FormViewer />} />
        <Route path="/forms/:id/responses" element={<Responses />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
