require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const bodyParser = require("body-parser");

const User = require("./models/User");
const Form = require("./models/Form");
const ResponseModel = require("./models/Response");
const getValidToken = require("./getValidToken");

const app = express();
app.use(cookieParser());
app.use(bodyParser.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: false }));
app.set("trust proxy", 1);


const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || "https://form-builder-pearl-one.vercel.app").replace(/\/$/, "");

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || origin === FRONTEND_ORIGIN || origin === "https://airtable.com") {
        return callback(null, true);
      }
      return callback(new Error("CORS policy: origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"]
  })
);


app.options(/.*/, (req, res) => {
  res.header("Access-Control-Allow-Origin", req.header("Origin") || FRONTEND_ORIGIN);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, X-Requested-With");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  return res.sendStatus(204);
});




const MONGO_URI = process.env.MONGO_URI;
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("Mongo connected"))
  .catch((e) => console.error("Mongo connection error:", e));

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,    
    sameSite: "none",
    path: "/",
  };
}



function validateAnswers(form, answers) {
  for (const q of form.questions) {
    const val = answers[q.questionKey];
    const isVisible = true;
    if (!isVisible) continue;

    if (q.required) {
      if (
        val === undefined ||
        val === null ||
        val === "" ||
        (Array.isArray(val) && val.length === 0)
      ) {
        return `${q.label} is required`;
      }
    }

    if (q.type.toLowerCase().includes("singleselect")) {
      const choices = q.options?.choices?.map((c) => c.name) || [];
      if (val && !choices.includes(val)) {
        return `${q.label}: invalid value`;
      }
    }

    if (q.type.toLowerCase().includes("multipleselect")) {
      const choices = q.options?.choices?.map((c) => c.name) || [];
      if (
        Array.isArray(val) &&
        val.some((v) => !choices.includes(v))
      ) {
        return `${q.label}: invalid value in multi-select`;
      }
    }
  }

  return null;
}


app.get("/auth/airtable/start", (req, res) => {
  const redirectUri = process.env.AIRTABLE_REDIRECT_URI.trim();
  const codeVerifier = crypto.randomBytes(32).toString("hex");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  const state = crypto.randomUUID();
  res.cookie("pkce_verifier", codeVerifier, cookieOptions());
  res.cookie("oauth_state", state, cookieOptions());

  const scopes = [
    "schema.bases:read",
    "data.records:read",
    "data.records:write",
    "webhook:manage",
  ].join(" ");

  const authUrl =
    `https://airtable.com/oauth2/v1/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(process.env.AIRTABLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent(scopes)}`;

  return res.redirect(authUrl);
});

app.get("/auth/airtable/callback", async (req, res) => {
  const { code, state } = req.query;
  console.log(state)
  if (!code) return res.status(400).send("Missing authorization code");
  if (!state || state !== req.cookies.oauth_state) return res.status(400).send("Invalid state");

  const codeVerifier = req.cookies.pkce_verifier;
  if (!codeVerifier) return res.status(400).send("Missing PKCE verifier");

  try {
    const data = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.AIRTABLE_REDIRECT_URI.trim(),
      code_verifier: codeVerifier,
    });

    const tokenResponse = await axios.post(
      "https://airtable.com/oauth2/v1/token",
      data.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`
            ).toString("base64"),
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const whoami = await axios.get("https://api.airtable.com/v0/meta/whoami", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const airtableUserId = whoami.data.id;

    await User.findOneAndUpdate(
      { airtableUserId },
      {
        airtableUserId,
        accessToken: access_token,
        refreshToken: refresh_token || undefined,
        tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
        lastLoginAt: new Date(),
      },
      { upsert: true }
    );

   res.cookie("token", access_token, cookieOptions());
    return res.redirect(`${FRONTEND_ORIGIN}/dashboard`);

  } catch (err) {
    console.error("TOKEN ERROR:", err.response?.data || err);
    return res.status(500).send("Token exchange failed");
  }
});

app.get("/auth/airtable/profile", async (req, res) => {
  const token = req.cookies.token;
  if (!token){
    console.log("came here ")
    return res.status(401).send({ error: "Not logged in" });
  }

  try {
    const response = await axios.get("https://api.airtable.com/v0/meta/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.send(response.data);
  } catch (err) {
    const status = err.response?.status;
    console.error("PROFILE ERR:", err.response?.data || err.message);

    if (status === 401 || status === 403) {
      return res.status(401).send({ error: "Authentication invalid or expired" });
    }
    return res.status(500).send({ error: "Failed to load profile" });
  }
});


app.get("/auth/airtable/bases", async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).send({ error: "Not logged in" });

  try {
    const response = await axios.get("https://api.airtable.com/v0/meta/bases", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return res.send(response.data);
  } catch (err) {
    console.error("BASES ERR:", err.response?.data || err.message);
    return res.status(500).send({ error: "Failed to load bases" });
  }
});

app.get("/auth/airtable/tables", async (req, res) => {
  const token = req.cookies.token;
  const baseId = req.query.base;
  if (!token) return res.status(401).send({ error: "Not logged in" });
  if (!baseId) return res.status(400).send({ error: "Missing base id" });

  try {
    const response = await axios.get(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return res.send(response.data);
  } catch (err) {
    console.error("TABLES ERR:", err.response?.data || err.message);
    return res.status(500).send({ error: "Failed to load tables" });
  }
});

app.post("/forms", async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).send({ error: "Not logged in" });

  const { baseId, tableId, tableName, fields } = req.body;
  if (!baseId || !tableId || !Array.isArray(fields))
    return res.status(400).send({ error: "Invalid payload" });

  try {
    const whoami = await axios.get("https://api.airtable.com/v0/meta/whoami", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const ownerId = whoami.data.id;

    const supported = [
      "singleLineText",
      "email",
      "phone",
      "number",
      "currency",
      "singleSelect",
      "multipleSelect",
      "multilineText",
      "attachment",
      "checkbox",
    ];

    const questions = fields
      .filter((f) =>
        supported.some((s) =>
          (f.type || "").toLowerCase().includes(s.toLowerCase())
        )
      )
      .map((f) => ({
        questionKey: crypto.randomUUID(),
        fieldId: f.id,
        label: f.name,
        type: f.type,
        name: f.name,
        required: false,
        options: f.options || null,
        conditional: null,
      }));

    const form = await Form.create({
      ownerAirtableUserId: ownerId,
      baseId,
      tableId,
      tableName,
      questions,
    });

    return res.send({ formId: form._id });
  } catch (err) {
    console.error("SAVE FORM ERR:", err.response?.data || err.message);
    return res.status(500).send({ error: "Failed to save form" });
  }
});

app.get("/forms/:id", async (req, res) => {
  try {
    const form = await Form.findById(req.params.id).lean();
    if (!form) return res.status(404).send({ error: "Form not found" });
    return res.send(form);
  } catch (err) {
    console.error("LOAD FORM ERR:", err.message);
    return res.status(500).send({ error: "Failed to load form" });
  }
});

app.post("/forms/:id/submit", async (req, res) => {
  const { answers } = req.body;
  if (!answers || typeof answers !== "object") {
    return res.status(400).send({ error: "Missing answers" });
  }

  try {
    const form = await Form.findById(req.params.id).lean();
    if (!form) return res.status(404).send({ error: "Form not found" });

    const errorMsg = validateAnswers(form, answers);

    if (errorMsg) return res.status(400).send({ error: errorMsg });

    let accessToken;
      try {
        accessToken = await getValidToken(form.ownerAirtableUserId);
      } catch (err) {
        console.error("TOKEN REFRESH ERR:", err);
        return res.status(401).send({ error: "Authentication expired, reconnect Airtable" });
      }

    const fieldsObj = {};
    form.questions.forEach((q) => {
      const val = answers[q.questionKey];
      if (val === undefined || val === null) return;

      if (q.type && q.type.toLowerCase().includes("attachment") && Array.isArray(val)) {
        fieldsObj[q.name] = val.map((v) => ({ url: v }));
      } else {
        fieldsObj[q.name] = val;
      }
    });

    const airtableUrl = `https://api.airtable.com/v0/${form.baseId}/${encodeURIComponent(form.tableName)}`;

    const airtableResp = await axios.post(
      airtableUrl,
      { fields: fieldsObj },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const recordId = airtableResp.data.id;

    const saved = await ResponseModel.create({
      formId: form._id,
      data: answers,
      airtableRecordId: recordId,
    });

    return res.send({ ok: true, recordId, responseId: saved._id });
  } catch (err) {
    console.error("SUBMIT ERR:", err.response?.data || err.message || err);
    return res.status(500).send({ error: "Failed to submit form" });
  }
});


app.get("/forms/:id/responses", async (req, res) => {
  try {
    const rows = await ResponseModel.find({ formId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    return res.send(rows);
  } catch (err) {
    console.error("RESPONSES ERR:", err);
    return res.status(500).send({ error: "Failed to load responses" });
  }
});


app.get("/search/forms", async (req, res) => {
  try {
    const owner = req.query.owner;
    const forms = await Form.find(owner ? { ownerAirtableUserId: owner } : {})
      .sort({ createdAt: -1 })
      .lean();
    return res.send({ forms });
  } catch (err) {
    console.error("SEARCH FORMS ERR:", err);
    return res.status(500).send({ error: "Failed to search forms" });
  }
});

app.get("/forms", async (req, res) => {
  try {
    const airtableUserId = req.query.userId;
    if (!airtableUserId) return res.status(400).json({ error: "userId is required" });

    const user = await User.findOne({ airtableUserId });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (new Date() > user.tokenExpiresAt) {
      // const params = new URLSearchParams({
      //   grant_type: "refresh_token",
      //   refresh_token: user.refreshToken,
      //   client_id: process.env.AIRTABLE_CLIENT_ID,
      //   client_secret: process.env.AIRTABLE_CLIENT_SECRET,
      // });

      // const refreshResponse = await axios.post(
      //   "https://airtable.com/oauth2/v1/token",
      //   params.toString(),
      //   { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      // );

      const params = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: user.refreshToken,
      });

      const refreshResponse = await axios.post(
        "https://airtable.com/oauth2/v1/token",
        params.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " +
              Buffer.from(
                `${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`
              ).toString("base64")
          }
        }
);


      user.accessToken = refreshResponse.data.access_token;
      user.refreshToken = refreshResponse.data.refresh_token ?? user.refreshToken;
      user.tokenExpiresAt = new Date(Date.now() + refreshResponse.data.expires_in * 1000);
      await user.save();

    }

    const airtableRes = await axios.get("https://api.airtable.com/v0/meta/whoami", {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });

    return res.json({ forms: airtableRes.data });
  } catch (err) {
    console.error("FORMS ERROR:", err.response?.data || err);
    res.status(500).json({ error: "Failed to fetch forms" });
  }
});

app.post("/webhooks/airtable", async (req, res) => {
  try {
    const body = req.body;
    if (!body || !Array.isArray(body.events)) {
      return res.send({ ok: true });
    }

    for (const evt of body.events) {
      const { baseId, tableId, recordId, changedFields, op } = evt;

      const form = await Form.findOne({ baseId, tableId }).lean();
      if (!form) continue;

      if (op === "delete") {
        await ResponseModel.findOneAndUpdate(
          { airtableRecordId: recordId },
          { deletedInAirtable: true }
        );
        continue;
      }

      if (op === "update") {
        const updated = {};
        for (const f of changedFields) {
          updated[`data.${f.fieldName}`] = f.newValue;
        }

        await ResponseModel.findOneAndUpdate(
          { airtableRecordId: recordId },
          { $set: updated }
        );
      }
    }

    res.send({ ok: true });
  } catch (err) {
    console.log("Webhook sync failed:", err.message);
    res.send({ ok: true });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on", PORT));
