import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./CSS/Response.css";

export default function Responses() {
  const { id } = useParams();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch(`http://localhost:5000/forms/${id}/responses`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setRows(data || []));
  }, [id]);

  return (
    <div className="resp-wrap">
      <h3 className="resp-title">Responses</h3>

      <table className="resp-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Data</th>
            <th>Airtable ID</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((item) => (
            <tr key={item._id}>
              <td>{new Date(item.createdAt).toLocaleString()}</td>
              <td>
                <pre>{JSON.stringify(item.data, null, 2)}</pre>
              </td>
              <td>{item.airtableRecordId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
