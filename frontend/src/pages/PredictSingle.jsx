// src/pages/PredictSingle.jsx
/**
 * PredictSingle.jsx
 *
 * Single-file UI that:
 * - keeps the original decorated UI layout (cards, gauges, pills)
 * - uses ONLY the backend-required fields in the payload (no extra fields)
 * - sends that payload to the backend via predictSingle(...) from ../services/api
 * - displays the ML response and a robust parsed explanation (handles strings, escaped-json, maps, arrays)
 *
 * NOTE: sample dataset used for training/testing (available in the environment):
 * /mnt/data/Sample_First_200_rows_final_v3.csv
 *
 * (You asked for a single-file result — this file contains full UI + logic.)
 */

import React, { useState } from "react";
import TopNav from "../components/TopNav";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  OverlayTrigger,
  Tooltip,
  ProgressBar,
} from "react-bootstrap";
import { predictSingle } from "../services/api";
import { toast } from "react-toastify";

// ------------------ UI HELPERS ------------------
const InfoPill = ({ label, value, variant = "secondary" }) => {
  if (value === undefined || value === null || value === "") return null;
  return (
    <Badge
      bg={variant}
      pill
      className="me-2 mb-2"
      style={{ fontSize: "0.7rem", fontWeight: 600 }}
    >
      {label}: {String(value)}
    </Badge>
  );
};

const Gauge = ({ label, value, suffix = "", variant = "info" }) => {
  const numeric = Number(value) || 0;
  const clamped = Math.max(0, Math.min(100, numeric));
  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between align-items-center">
        <span className="small text-muted">{label}</span>
        <span className="small">
          <strong>{clamped.toFixed(1)}</strong>
          {suffix}
        </span>
      </div>
      <ProgressBar
        now={clamped}
        variant={variant}
        style={{ height: 8 }}
        className="rounded-pill mt-1"
      />
    </div>
  );
};

// ------------------ Explanation parser (robust) ------------------
/**
 * parseExplanation attempts to convert many shapes of `explanation` into a normalized object:
 * - If it's already an object → return it
 * - If it's a JSON string (possibly escaped) → parse
 * - If it's a string that looks like a map "{a=1, b=2}" → convert to JSON
 * - If it's a simple comma-separated reason string → place into { human_readable_reasons: [ ... ] }
 */
function parseExplanation(raw) {
  if (!raw && raw !== 0) return {};

  // If already an object
  if (typeof raw === "object") return raw;

  // If it's a string
  if (typeof raw === "string") {
    let s = raw.trim();

    // Attempt: if string is double-encoded JSON (like "\"{...}\"" or contains escaped quotes)
    try {
      // First try direct JSON parse
      const direct = JSON.parse(s);
      // If the parsed value is still a string (double encoding), parse again
      if (typeof direct === "string") {
        try {
          return JSON.parse(direct);
        } catch {
          // fallback to direct
          return typeof direct === "object" ? direct : { raw: direct };
        }
      }
      return typeof direct === "object" ? direct : { raw: direct };
    } catch (e) {
      // not direct JSON

      // Try to fix Python-style dict string: "{a=1, b=2}" or "{'a': '1', 'b': '2'}"
      // Replace single quotes with double quotes, equal signs with colon if present, etc.
      const tryFix = (() => {
        try {
          // handle patterns like {"key": "value"} but escaped as string with backslashes
          // Remove outer quotes if present and string looks like "{...}"
          let candidate = s;

          // Remove surrounding quotes if whole string is wrapped in quotes
          if (
            (candidate.startsWith('"') && candidate.endsWith('"')) ||
            (candidate.startsWith("'") && candidate.endsWith("'"))
          ) {
            candidate = candidate.substring(1, candidate.length - 1);
          }

          // if candidate contains = instead of :
          if (candidate.includes("=") && !candidate.includes(":")) {
            // convert key=value to "key":value
            // very naive but works for simple cases
            const parts = candidate
              .replace(/^\{/, "")
              .replace(/\}$/, "")
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean);

            const obj = {};
            parts.forEach((part) => {
              const kv = part.split("=");
              if (kv.length >= 2) {
                const key = kv[0].trim().replace(/^["']|["']$/g, "");
                let val = kv.slice(1).join("=").trim();
                // remove surrounding quotes
                val = val.replace(/^["']|["']$/g, "");
                // numeric?
                if (/^-?\d+(\.\d+)?$/.test(val)) {
                  obj[key] = Number(val);
                } else if (val.toLowerCase() === "true" || val.toLowerCase() === "false") {
                  obj[key] = val.toLowerCase() === "true";
                } else {
                  obj[key] = val;
                }
              }
            });
            return obj;
          }

          // if candidate looks like a list of reasons: "[reason1, reason2]" or "reason1, reason2"
          // try to extract quoted entries
          if (
            candidate.startsWith("[") &&
            candidate.endsWith("]") &&
            candidate.includes(",")
          ) {
            const inner = candidate.substring(1, candidate.length - 1).trim();
            // split by comma while preserving inner commas in quotes
            const parts = inner
              .split(/,(?![^"]*"(?:(?:[^"]*"){2})*[^"]*$)/)
              .map((p) => p.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, ""))
              .filter(Boolean);
            return { human_readable_reasons: parts };
          }

          // fallback: if string contains " — " or "." separated sentences, split into array of lines
          if (candidate.includes("—") || candidate.includes(". ")) {
            const sentences = candidate
              .split(/(?:—|\.|\n)+/)
              .map((x) => x.trim())
              .filter(Boolean);
            if (sentences.length > 0) {
              return { human_readable_reasons: sentences };
            }
          }

          // final fallback: return raw as text
          return { raw: candidate };
        } catch (err) {
          return { raw: s };
        }
      })();

      return tryFix;
    }
  }

  // If anything else, return raw
  return { raw };
}

// small helper to ensure reasons is array for safe rendering
function ensureReasonsArray(expl) {
  if (!expl) return [];
  const r = expl.human_readable_reasons ?? expl.human_readable_reason ?? expl.reasons ?? null;
  if (!r) return [];
  if (Array.isArray(r)) return r;
  if (typeof r === "string") {
    // If looks like JSON array string
    const trimmed = r.trim();
    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith('"[') && trimmed.endsWith(']"'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    // split by semicolon/comma/pipe/newline
    const parts = r.split(/[,;\n|•]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts;
    return [r];
  }
  // if it's object or other, return empty
  return [];
}

// ------------------ MAIN COMPONENT ------------------
export default function PredictSingle() {
  // Only the exact set of fields requested by the user. No extra payload keys.
  const [form, setForm] = useState({
    name: "Test Student",
    district: "Chennai",
    cutoff: 2000,
    preferred_location: "chennai",
    preferred_course: "any",
    family_income_tier: "any",

    family_income: 5000,
    family_members: 4,

    marks_10: 450,
    marks_11: 430,
    marks_12: 440,

    motivational_score: 78,
    attendance_rate: 85,
    communication_freq: 6,
    interest_lvl: 7,
    family_support: 4,

    academic_score: 90,

    orphan: "no",
    single_parent: "no",
    first_graduate: "no",
    girlchild: "no",
    attitude: "positive",
  });

  // result is the raw response from backend
  const [result, setResult] = useState(null);
  // parsedNormalizedExplanation is the safe parsed explanation object
  const [parsedExplanation, setParsedExplanation] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Build payload exactly with only the required fields
  const buildPayload = (f) => ({
    // Keep exactly these keys (no extras)
    name: f.name,
    district: f.district,
    cutoff: Number(f.cutoff),
    preferred_location: f.preferred_location,
    preferred_course: f.preferred_course,
    family_income_tier: f.family_income_tier,
    family_income: Number(f.family_income),
    family_members: Number(f.family_members),
    marks_10: Number(f.marks_10),
    marks_11: Number(f.marks_11),
    marks_12: Number(f.marks_12),
    motivational_score: Number(f.motivational_score),
    attendance_rate: Number(f.attendance_rate),
    communication_freq: Number(f.communication_freq),
    interest_lvl: Number(f.interest_lvl),
    family_support: Number(f.family_support),
    academic_score: Number(f.academic_score),
    orphan: String(f.orphan),
    single_parent: String(f.single_parent),
    first_graduate: String(f.first_graduate),
    girlchild: String(f.girlchild),
    attitude: String(f.attitude),
  });

  // Submit handler - sends payload and processes explanation robustly
  const submit = async (e) => {
    e?.preventDefault?.();
    setSubmitting(true);
    setResult(null);
    setParsedExplanation({});
    try {
      const payload = buildPayload(form);
      const resp = await predictSingle(payload);

      // Some backends return explanation as JSON-string or map-like string
      const explanationRaw = resp?.explanation ?? null;

      // Parse explanation robustly
      const parsed = parseExplanation(explanationRaw);

      // Normalize some common numeric fields into numbers (if strings)
      if (resp?.dropout_probability !== undefined) {
        resp.dropout_probability = Number(resp.dropout_probability);
      }
      if (resp?.deservingness_score !== undefined) {
        resp.deservingness_score = Number(resp.deservingness_score);
      }

      setResult(resp);
      setParsedExplanation(parsed);
      toast.success("Prediction fetched");
    } catch (err) {
      console.error("Prediction failed:", err);
      toast.error("Prediction failed");
      setResult({ error: (err && err.message) || "Unknown error" });
    } finally {
      setSubmitting(false);
    }
  };

  // formatting helpers for UI
  const dropoutPct = result ? (Number(result.dropout_probability || 0) * 100).toFixed(1) : "0.0";
  const deservingScore = result ? (Number(result.deservingness_score || 0)).toFixed(2) : "0.00";

  const reasonsArray = ensureReasonsArray(parsedExplanation);
  const topFeatures = (() => {
    const val = parsedExplanation?.global_top_model_features ?? parsedExplanation?.top_features ?? parsedExplanation?.global_top_model_feature;
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
      // comma-split fallback
      return val.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
  })();

  const pageBackground = "linear-gradient(180deg, #eff6ff 0%, #ffffff 40%, #f9fafb 100%)";
  const headerGradient = "linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(239,246,255,1) 40%, rgba(219,234,254,1) 100%)";

  // UI layout: visually detailed, using same look/feel as your original large UI.
  // Important: functionality unchanged; uses only the allowed fields in the payload.
  return (
    <>
      <TopNav />
      <div style={{ minHeight: "100vh", background: pageBackground, fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont' }}>
        <Container className="py-4">
          {/* HEADER STRIP */}
          <Row className="mb-3">
            <Col>
              <Card className="border-0 shadow-sm" style={{ borderRadius: 18, background: headerGradient }}>
                <Card.Body className="d-flex justify-content-between flex-wrap align-items-center">
                  <div className="mb-2 mb-md-0">
                    <h3 className="mb-1" style={{ color: "#111827", fontWeight: 700 }}>Single Student Prediction</h3>
                    <small className="text-muted">
                      Enter the student's academic, family and support details below — the form sends a direct request to the ML API and displays detailed results.
                    </small>
                  </div>

                  <div className="text-end">
                    <InfoPill label="Default district" value={form.district} variant="primary" />
                    <InfoPill label="Cutoff" value={form.cutoff} variant="info" />
                    <div className="small text-muted mt-1">Payload uses the exact schema required by the ML backend.</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* FORM */}
          <Form onSubmit={submit}>
            <Row className="g-4">
              {/* LEFT large column */}
              <Col lg={8}>
                {/* ACADEMIC */}
                <Card className="p-3 mb-3 shadow-sm border-0" style={{ borderRadius: 18 }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <h5 className="mb-0">Academic Information</h5>
                      <small className="text-muted">These academic fields are used directly by the model.</small>
                    </div>
                    <OverlayTrigger placement="left" overlay={<Tooltip id="ac-tip">Higher academic and attendance values typically reduce dropout risk and increase deservingness.</Tooltip>}>
                      <span className="badge bg-light text-secondary" style={{ cursor: "help" }}>?</span>
                    </OverlayTrigger>
                  </div>

                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Academic Score</Form.Label>
                        <Form.Control type="number" value={form.academic_score} onChange={(e) => update("academic_score", Number(e.target.value || 0))} />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Motivational Score</Form.Label>
                        <Form.Control type="number" value={form.motivational_score} onChange={(e) => update("motivational_score", Number(e.target.value || 0))} />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Marks 10</Form.Label>
                        <Form.Control type="number" value={form.marks_10} onChange={(e) => update("marks_10", Number(e.target.value || 0))} />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Marks 11</Form.Label>
                        <Form.Control type="number" value={form.marks_11} onChange={(e) => update("marks_11", Number(e.target.value || 0))} />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Marks 12</Form.Label>
                        <Form.Control type="number" value={form.marks_12} onChange={(e) => update("marks_12", Number(e.target.value || 0))} />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label>Attendance Rate (%)</Form.Label>
                        <Form.Control type="number" value={form.attendance_rate} onChange={(e) => update("attendance_rate", Number(e.target.value || 0))} />
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label>10th Passed Out Year</Form.Label>
                        {/* kept simple input so user can enter year if needed */}
                        <Form.Control type="number" value={new Date().getFullYear()} disabled />
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label>Cutoff (for 200)</Form.Label>
                        <Form.Control type="number" value={form.cutoff} onChange={(e) => update("cutoff", Number(e.target.value || 0))} />
                        <Form.Text className="small text-muted">
                          The ML receives this cutoff value directly.
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </Card>

                {/* FAMILY */}
                <Card className="p-3 mb-3 shadow-sm border-0" style={{ borderRadius: 18 }}>
                  <h5>Family Information</h5>
                  <small className="text-muted">Family income and members directly affect model predictions.</small>

                  <Row className="mt-2">
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Family Income</Form.Label>
                        <Form.Control type="number" value={form.family_income} onChange={(e) => update("family_income", Number(e.target.value || 0))} />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Family Members</Form.Label>
                        <Form.Control type="number" value={form.family_members} onChange={(e) => update("family_members", Number(e.target.value || 0))} />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row>
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Orphan</Form.Label>
                        <Form.Select value={form.orphan} onChange={(e) => update("orphan", e.target.value)}>
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Single Parent</Form.Label>
                        <Form.Select value={form.single_parent} onChange={(e) => update("single_parent", e.target.value)}>
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Girl Child</Form.Label>
                        <Form.Select value={form.girlchild} onChange={(e) => update("girlchild", e.target.value)}>
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                </Card>

                {/* SUPPORT */}
                <Row>
                  <Col md={6}>
                    <Card className="p-3 mb-3 shadow-sm border-0" style={{ borderRadius: 18 }}>
                      <h5>Support & Engagement</h5>
                      <small className="text-muted">Communication, interest and family support are quantized for the model.</small>

                      <Form.Group className="mb-3 mt-2">
                        <Form.Label>Communication Frequency (numeric)</Form.Label>
                        <Form.Control type="number" value={form.communication_freq} onChange={(e) => update("communication_freq", Number(e.target.value || 0))} />
                        <Form.Text className="small text-muted">Higher values indicate more frequent contact.</Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Interest Level (1-10)</Form.Label>
                        <Form.Control type="number" value={form.interest_lvl} onChange={(e) => update("interest_lvl", Number(e.target.value || 0))} />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Family Support (1-10)</Form.Label>
                        <Form.Control type="number" value={form.family_support} onChange={(e) => update("family_support", Number(e.target.value || 0))} />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Attitude (text)</Form.Label>
                        <Form.Control type="text" value={form.attitude} onChange={(e) => update("attitude", e.target.value)} />
                        <Form.Text className="small text-muted">Free text (positive/neutral/negative).</Form.Text>
                      </Form.Group>
                    </Card>
                  </Col>

                  <Col md={6}>
                    <Card className="p-3 mb-3 shadow-sm border-0" style={{ borderRadius: 18 }}>
                      <h5>Preferences</h5>
                      <small className="text-muted">Preferred location/course boundaries can affect dropout risk.</small>

                      <Form.Group className="mb-3 mt-2">
                        <Form.Label>Preferred Location</Form.Label>
                        <Form.Control value={form.preferred_location} onChange={(e) => update("preferred_location", e.target.value)} />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Preferred Course</Form.Label>
                        <Form.Control value={form.preferred_course} onChange={(e) => update("preferred_course", e.target.value)} />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Family Income Tier</Form.Label>
                        <Form.Select value={form.family_income_tier} onChange={(e) => update("family_income_tier", e.target.value)}>
                          <option value="any">any</option>
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                        </Form.Select>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>First Graduate</Form.Label>
                        <Form.Select value={form.first_graduate} onChange={(e) => update("first_graduate", e.target.value)}>
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </Form.Select>
                      </Form.Group>
                    </Card>
                  </Col>
                </Row>

                <Button type="submit" className="mt-2 mb-4" disabled={submitting}>
                  {submitting ? "Predicting..." : "Predict"}
                </Button>
              </Col>

              {/* RIGHT panel */}
              <Col lg={4}>
                <Card className="p-3 shadow-sm border-0" style={{ borderRadius: 18 }}>
                  <h5 className="mb-1">Prediction Result</h5>
                  <small className="text-muted">Results are returned directly from the ML API and shown below.</small>

                  <div className="mt-3">
                    {result ? (
                      <>
                        {/* Basic numeric display */}
                        <p className="mb-1"><strong>Dropout Probability:</strong> <span style={{ color: "#b91c1c" }}>{dropoutPct}%</span></p>
                        <p className="mb-1"><strong>Deservingness Score:</strong> <span style={{ color: "#16a34a" }}>{deservingScore}</span></p>

                        <p className="mb-2"><strong>Risk Tier:</strong> <span className={`badge ${result?.risk_tier === "HIGH" ? "bg-danger" : result?.risk_tier === "MEDIUM" ? "bg-warning text-dark" : "bg-success"}`}>{result?.risk_tier ?? "UNKNOWN"}</span></p>

                        {/* parsed explanation */}
                        <div className="mt-2 small">
                          <h6 style={{ marginBottom: 6 }}>Why this prediction?</h6>

                          {/* Show model probability and rule probability if present */}
                          {parsedExplanation?.model_probability !== undefined && (
                            <p className="mb-1"><strong>Model Probability:</strong> {(Number(parsedExplanation.model_probability) * 100).toFixed(1)}%</p>
                          )}

                          {parsedExplanation?.rule_probability !== undefined && (
                            <p className="mb-1"><strong>Rule Probability:</strong> {(Number(parsedExplanation.rule_probability) * 100).toFixed(1)}%</p>
                          )}

                          {/* Human readable reasons */}
                          {reasonsArray.length > 0 ? (
                            <div className="mt-2">
                              <strong>Reasons:</strong>
                              <ul className="mt-1">
                                {reasonsArray.map((r, idx) => (
                                  <li key={idx}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <div className="small text-muted">No human-friendly reasons returned.</div>
                          )}

                          {/* Top model features */}
                          {topFeatures.length > 0 && (
                            <div className="mt-2">
                              <strong>Top features:</strong> {topFeatures.join(", ")}
                            </div>
                          )}
                        </div>

                        {/* Raw response preview */}
                        {/* <div className="mt-3">
                          <small className="text-muted">Raw response (for debugging):</small>
                          <pre style={{ maxHeight: 220, overflowY: "auto", background: "#f8fafc", padding: 10, borderRadius: 8 }}>{JSON.stringify(result, null, 2)}</pre>
                        </div> */}
                      </>
                    ) : (
                      <p className="text-muted mt-3">No result yet. Fill the fields and click <strong>Predict</strong>.</p>
                    )}
                  </div>
                </Card>
                {/* INPUT SUMMARY */}
                <Card className="p-3 mb-3 shadow-sm border-0" style={{ borderRadius: 18 }}>
                  <h5 className="mb-1">Input Summary</h5>
                  <small className="text-muted">Quick glance at what is being sent to the model (only allowed fields).</small>

                  <div className="mt-3">
                    <InfoPill label="Academic" value={form.academic_score} variant="primary" />
                    <InfoPill label="Motivation" value={form.motivational_score} variant="info" />
                    <InfoPill label="Attendance" value={`${form.attendance_rate}%`} variant="success" />
                    <InfoPill label="Family income" value={form.family_income} variant="warning" />
                    <InfoPill label="Preferred location" value={form.preferred_location} variant="secondary" />
                  </div>

                  <div className="mt-3">
                    <Gauge label="Academic score (approx)" value={form.academic_score} suffix="/100" variant="primary" />
                    <Gauge label="Motivation (scaled)" value={Math.min(100, (Number(form.motivational_score) || 0))} suffix="/100" variant="info" />
                    <Gauge label="Attendance rate" value={form.attendance_rate} suffix="%" variant="success" />
                  </div>
                </Card>

                {/* PREDICTION RESULT */}
              </Col>
            </Row>
          </Form>
        </Container>
      </div>
    </>
  );
}
