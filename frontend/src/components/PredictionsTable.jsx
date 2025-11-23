// src/components/PredictionsTable.jsx
import React, { useState } from "react";
import { Table, Badge, Collapse, Button } from "react-bootstrap";

function prettyExplanation(expl) {
  // expl might be already an object, a JSON-string, or a compact string.
  if (!expl) return { model_probability: null, rule_probability: null, top_rule_reasons: [], global_top_model_features: [] };
  try {
    if (typeof expl === "object") return {
      model_probability: expl.model_probability ?? expl.model_probability,
      rule_probability: expl.rule_probability ?? expl.rule_probability,
      top_rule_reasons:
  expl.top_rule_reasons ??
  expl.human_readable_reasons ??
  [],

      global_top_model_features: expl.global_top_model_features ?? expl.global_top_model_features ?? []
    };
    // try parse JSON string
    if (typeof expl === "string") {
      // sometimes flask returned a string like "{model_probability=0.75, ...}"
      // try JSON.parse first
      try {
        const parsed = JSON.parse(expl);
        return {
          model_probability: parsed.model_probability,
          rule_probability: parsed.rule_probability,
          top_rule_reasons: parsed.top_rule_reasons || [],
          global_top_model_features: parsed.global_top_model_features || []
        };
      } catch (_) {
        // fallback: try to extract common tokens using regex
        const model_p = (expl.match(/model_probability[:=]\s*([0-9.]+)/) || expl.match(/model_probability[:=]\s*([0-9.]+)/i));
        const rule_p = (expl.match(/rule_probability[:=]\s*([0-9.]+)/) || expl.match(/rule_probability[:=]\s*([0-9.]+)/i));
        const reasons = (expl.match(/top_rule_reasons[:=]\[([^\]]+)\]/) || expl.match(/top_rule_reasons[:=]\[([^\]]+)\]/i));
        const features = (expl.match(/global_top_model_features[:=]\[([^\]]+)\]/) || expl.match(/global_top_model_features[:=]\[([^\]]+)\]/i));
        return {
          model_probability: model_p ? Number(model_p[1]) : null,
          rule_probability: rule_p ? Number(rule_p[1]) : null,
          top_rule_reasons: reasons ? reasons[1].split(",").map(s => s.trim()) : [],
          global_top_model_features: features ? features[1].split(",").map(s => s.trim()) : []
        };
      }
    }
  } catch (e) {
    return { model_probability: null, rule_probability: null, top_rule_reasons: [], global_top_model_features: [] };
  }
}

export default function PredictionsTable({ rows }) {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <Table
      hover
      responsive
      className="shadow-sm border-0"
      style={{
        fontFamily: '"Inter", sans-serif',
        borderRadius: 18,
        overflow: "hidden",
        background: "white",
      }}
    >
      <thead style={{ background: "#f9fafb" }}>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>Academic</th>
          <th>Motivation</th>
          <th>Attendance</th>
          <th>Dropout %</th>
          <th>Deserving</th>
          <th>Risk</th>
          <th>Explanation</th>
        </tr>
      </thead>

      <tbody>
        {rows.map((r, i) => {
          // Support different input shapes: dropout_probability may already be 0-100 or 0-1
          const rawProb = Number(r.dropout_probability ?? r.dropoutProbability ?? 0);
          const probPct = rawProb > 1 ? rawProb : rawProb * 100;
          const expl = prettyExplanation(r.explanation || r.explanation_json || r.explanationText);

          return (
            <React.Fragment key={i}>
              <tr>
                <td style={{ width: 40 }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{r.name || "—"}</td>
                <td>{r.academic_score ?? r.academicScore ?? "—"}</td>
                <td>{r.motivational_score ?? r.motivation_level ?? r.motivationLevel ?? "—"}</td>
                <td>{r.attendance_rate ?? r.attendanceRate ?? "—"}</td>
                <td style={{ fontWeight: 600 }}>{(Number(probPct) || 0).toFixed(1)}%</td>
                <td>{(Number(r.deservingness_score || r.deservingnessScore || 0)).toFixed(2)}</td>
                <td>
                  <Badge
                    bg={
                      (r.risk_tier || r.riskTier || "LOW") === "HIGH"
                        ? "danger"
                        : (r.risk_tier || r.riskTier || "LOW") === "MEDIUM"
                        ? "warning"
                        : "success"
                    }
                    pill
                  >
                    {String(r.risk_tier || r.riskTier || "LOW")}
                  </Badge>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  >
                    {openIdx === i ? "Hide" : "View"}
                  </Button>
                </td>
              </tr>

              <tr>
                <td colSpan={9} style={{ padding: 0, borderTop: 0 }}>
                  <Collapse in={openIdx === i}>
                    <div style={{ padding: 12, background: "#fbfbfd" }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>
                        Explanation & Reasons
                      </div>

                      <div className="small text-muted mb-2">
                        <strong>Model probability:</strong>{" "}
                        {expl.model_probability !== null ? (Number(expl.model_probability) * 100).toFixed(1) + "%" : "N/A"}{" "}
                        • <strong>Rule probability:</strong>{" "}
                        {expl.rule_probability !== null ? (Number(expl.rule_probability) * 100).toFixed(1) + "%" : "N/A"}
                      </div>

                      <div style={{ marginBottom: 6 }}>
                        <strong>Top rule reasons:</strong>
                        {expl.top_rule_reasons && expl.top_rule_reasons.length ? (
                          <ul className="mb-2">
                            {expl.top_rule_reasons.map((t, idx) => (
                              <li key={idx} className="small text-muted">{String(t)}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="small text-muted">No rule reasons returned.</div>
                        )}
                      </div>

                      <div>
                        <strong>Top model features:</strong>
                        {expl.global_top_model_features && expl.global_top_model_features.length ? (
                          <div className="small text-muted">
                            {expl.global_top_model_features.join(", ")}
                          </div>
                        ) : (
                          <div className="small text-muted">No model feature info.</div>
                        )}
                      </div>
                    </div>
                  </Collapse>
                </td>
              </tr>
            </React.Fragment>
          );
        })}
      </tbody>
    </Table>
  );
}
