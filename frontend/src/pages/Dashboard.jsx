// src/pages/Dashboard.jsx
import React, { useEffect, useState, useMemo } from 'react';
import TopNav from '../components/TopNav';
import {
  Container,
  Row,
  Col,
  Card,
  Badge,
  Spinner,
  OverlayTrigger,
  Tooltip,
  ProgressBar,
} from 'react-bootstrap';
import StatsCard from '../components/StatsCard';
import PredictionsTable from '../components/PredictionsTable';
import { getStudents, predictSingle } from '../services/api';

/**
 * Small pill for summary labels
 */
const Pill = ({ label, value, variant = 'secondary' }) => (
  <Badge
    bg={variant}
    pill
    className="me-2 mb-1"
    style={{ fontWeight: 500, fontSize: '0.7rem' }}
  >
    {label}: {value}
  </Badge>
);

/**
 * Simple horizontal bars instead of a heavy chart lib
 * Shows High / Medium / Low distribution with nice colours.
 */
const RiskBars = ({ counts, total }) => {
  const { HIGH = 0, MEDIUM = 0, LOW = 0 } = counts;
  const safeTotal = total || HIGH + MEDIUM + LOW || 1;

  const highPct = Math.round((HIGH / safeTotal) * 100);
  const medPct = Math.round((MEDIUM / safeTotal) * 100);
  const lowPct = Math.round((LOW / safeTotal) * 100);

  return (
    <div className="mt-2">
      <div className="mb-2 small text-muted">Risk level distribution</div>
      <div className="mb-2">
        <div className="d-flex justify-content-between mb-1">
          <span className="small">
            <span style={{ color: '#dc3545', fontWeight: 600 }}>High</span>
          </span>
          <span className="small text-muted">{highPct}%</span>
        </div>
        <ProgressBar
          now={highPct}
          style={{ height: 8 }}
          variant="danger"
          className="rounded-pill"
        />
      </div>

      <div className="mb-2">
        <div className="d-flex justify-content-between mb-1">
          <span className="small">
            <span style={{ color: '#ffc107', fontWeight: 600 }}>Medium</span>
          </span>
          <span className="small text-muted">{medPct}%</span>
        </div>
        <ProgressBar
          now={medPct}
          style={{ height: 8 }}
          variant="warning"
          className="rounded-pill"
        />
      </div>

      <div>
        <div className="d-flex justify-content-between mb-1">
          <span className="small">
            <span style={{ color: '#28a745', fontWeight: 600 }}>Low</span>
          </span>
          <span className="small text-muted">{lowPct}%</span>
        </div>
        <ProgressBar
          now={lowPct}
          style={{ height: 8 }}
          variant="success"
          className="rounded-pill"
        />
      </div>
    </div>
  );
};

/**
 * Pretty badge for risk level inside the table & cards
 */
const RiskBadge = ({ tier }) => {
  if (!tier) return <Badge bg="secondary">N/A</Badge>;
  const upper = String(tier).toUpperCase();
  const map = {
    HIGH: 'danger',
    MEDIUM: 'warning',
    LOW: 'success',
  };
  const variant = map[upper] || 'secondary';
  return (
    <Badge bg={variant} pill style={{ fontWeight: 600 }}>
      {upper}
    </Badge>
  );
};
// ✅ explanation parser for PredictionsTable
const parseExplanation = (raw) => {
  if (!raw) return null;

  let obj = null;

  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { raw };
    }
  } else if (typeof raw === "object") {
    obj = raw;
  }

  if (!obj) return null;

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const listify = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    const s = String(v).replace(/^\[|\]$/g, "");
    return s
      .split(",")
      .map((x) => x.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  };

  return {
    final_probability_used: toNum(obj.final_probability_used),
    model_probability: toNum(obj.model_probability),
    rule_probability: toNum(obj.rule_probability),
    global_top_model_features: listify(
      obj.global_top_model_features || obj.top_features
    ),
   human_readable_reasons: listify(
  obj.human_readable_reasons ||
  obj.humanReadableReasons ||
  obj.reasons
),

  };
};

/**
 * Main Dashboard page
 */
export default function Dashboard() {
  const [students, setStudents] = useState([]);
  const [preds, setPreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);

  // helper: use the student object directly as payload (it already has snake_case fields)
  const buildPayloadFromStudent = (s) => {
    const { id, ...rest } = s; // id not needed by model
    return rest;
  };

  // Load students + score a subset
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getStudents();
        const arr = Array.isArray(data) ? data : [];
        setStudents(arr);

        if (arr.length === 0) {
          setPreds([]);
          return;
        }

        setScoring(true);

        // score up to 40 students for the dashboard
        const subset = arr.slice(0, 40);

        const withPreds = await Promise.all(
  subset.map(async (s) => {
    try {
      const payload = buildPayloadFromStudent(s);
      const p = await predictSingle(payload);

      return {
        ...s,
        dropout_probability: Number(p.dropout_probability),
        deservingness_score: Number(p.deservingness_score),
        risk_tier:
          p.risk_tier ?? p.riskTier ?? 'LOW',

        // ✅ ADD THIS
        explanation:
          p.explanation ??
          p.explanation_json ??
          p.explanationJson ??
          null,
      };
    } catch {
      return {
        ...s,
        dropout_probability: 0,
        deservingness_score: 0,
        risk_tier: 'LOW',

        // ✅ fallback
        explanation: null,
      };
    }
  })
);


        setPreds(withPreds);
      } catch (e) {
        console.error(e);
        setStudents([]);
        setPreds([]);
      } finally {
        setScoring(false);
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---------- derived metrics ----------
  const { highCount, medCount, lowCount, avgDeserving, avgAttendance } =
    useMemo(() => {
      if (!preds.length) {
        return {
          highCount: 0,
          medCount: 0,
          lowCount: 0,
          avgDeserving: 0,
          avgAttendance: 0,
        };
      }

      const high = preds.filter((p) => p.risk_tier === 'HIGH').length;
      const med = preds.filter((p) => p.risk_tier === 'MEDIUM').length;
      const low = preds.filter((p) => p.risk_tier === 'LOW').length;

      const avgD =
        preds.reduce(
          (sum, p) => sum + (Number(p.deservingness_score) || 0),
          0
        ) / preds.length;

      const avgA =
        preds.reduce(
          (sum, p) =>
            sum +
            (Number(
              p.attendance_rate !== undefined
                ? p.attendance_rate
                : p.attendanceRate
            ) || 0),
          0
        ) / preds.length;

      return {
        highCount: high,
        medCount: med,
        lowCount: low,
        avgDeserving: Math.round(avgD || 0),
        avgAttendance: Math.round(avgA || 0),
      };
    }, [preds]);

  const chartCounts = {
    HIGH: highCount,
    MEDIUM: medCount,
    LOW: lowCount,
  };

  // sort by risk (high → low)
  const topRisk = useMemo(() => {
    if (!preds.length) return [];
    return [...preds]
      .sort(
        (a, b) =>
          Number(b.dropout_probability || 0) -
          Number(a.dropout_probability || 0)
      )
      .slice(0, 15);
  }, [preds]);

  const headerGradient =
    'linear-gradient(135deg, rgba(248,250,252,1) 0%, rgba(239,246,255,1) 40%, rgba(219,234,254,1) 100%)';

  const pageBackground =
    'linear-gradient(180deg, #eff6ff 0%, #ffffff 40%, #f9fafb 100%)';

  return (
    <>
      <TopNav />
      <div
        style={{
          minHeight: '100vh',
          background: pageBackground,
          fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont',
        }}
      >
        <Container fluid className="py-4">
          {/* HEADER STRIP */}
          <Row className="mb-3">
            <Col>
              <Card
                className="border-0 shadow-sm"
                style={{
                  borderRadius: 18,
                  background: headerGradient,
                }}
              >
                <Card.Body className="d-flex justify-content-between align-items-center flex-wrap">
                  <div className="mb-2 mb-md-0">
                    <h3
                      className="mb-1"
                      style={{ color: '#111827', fontWeight: 700 }}
                    >
                      DeserveIQ Overview
                    </h3>
                    <small className="text-muted">
                      Monitor dropout risk & deservingness scores across your
                      uploaded students.
                    </small>
                  </div>
                  <div className="text-end">
                    <div className="mb-1">
                      <Pill
                        label="Students"
                        value={students.length}
                        variant="primary"
                      />
                      <Pill
                        label="Scored"
                        value={preds.length}
                        variant="info"
                      />
                    </div>
                    <small className="text-muted">
                      {new Date().toLocaleDateString()} • Auto-synced
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* METRIC CARDS */}
          <Row className="mb-4 g-3">
            <Col md={3} sm={6} xs={12}>
              <StatsCard
                title="Students"
                value={students.length}
                subtitle="Total"
                variant="primary"
              />
            </Col>
            <Col md={3} sm={6} xs={12}>
              <StatsCard
                title="At-Risk"
                value={highCount}
                subtitle="High"
                variant="danger"
              />
            </Col>
            <Col md={3} sm={6} xs={12}>
              <StatsCard
                title="Avg Deserving"
                value={avgDeserving}
                subtitle="Score"
                variant="success"
              />
            </Col>
            <Col md={3} sm={6} xs={12}>
              <StatsCard
                title="Avg Attendance"
                value={avgAttendance}
                subtitle="%"
                variant="info"
              />
            </Col>
          </Row>

          {/* MAIN CONTENT */}
          <Row className="g-4">
            {/* LEFT: Risk Distribution */}
            <Col lg={4}>
              <Card
                className="h-100 shadow-sm border-0"
                style={{ borderRadius: 18 }}
              >
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <Card.Title className="mb-0">
                        Risk Distribution
                      </Card.Title>
                      <small className="text-muted">
                        Across scored students
                      </small>
                    </div>
                    {scoring ? (
                      <Badge bg="info" pill>
                        Scoring…
                      </Badge>
                    ) : (
                      <Badge bg="light" text="secondary" pill>
                        {preds.length} scored
                      </Badge>
                    )}
                  </div>

                  {loading ? (
                    <div className="text-center my-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      <span className="text-muted">Loading data…</span>
                    </div>
                  ) : preds.length === 0 ? (
                    <p className="text-muted mt-3">
                      No predictions yet. Upload a CSV from{' '}
                      <strong>Batch Upload</strong> to see risk distribution.
                    </p>
                  ) : (
                    <>
                      <RiskBars counts={chartCounts} total={preds.length} />

                      <hr />

                      <div
                        className="d-flex justify-content-between flex-wrap"
                        style={{ rowGap: 8 }}
                      >
                        <div className="small">
                          <span
                            className="me-1"
                            style={{ color: '#dc3545', fontWeight: 600 }}
                          >
                            ● High
                          </span>
                          <span className="text-muted">
                            {highCount} student(s)
                          </span>
                        </div>
                        <div className="small">
                          <span
                            className="me-1"
                            style={{ color: '#ffc107', fontWeight: 600 }}
                          >
                            ● Medium
                          </span>
                          <span className="text-muted">
                            {medCount} student(s)
                          </span>
                        </div>
                        <div className="small">
                          <span
                            className="me-1"
                            style={{ color: '#28a745', fontWeight: 600 }}
                          >
                            ● Low
                          </span>
                          <span className="text-muted">
                            {lowCount} student(s)
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* RIGHT: Top At-Risk Students */}
            <Col lg={8}>
              <Card
                className="h-100 shadow-sm border-0"
                style={{ borderRadius: 18 }}
              >
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div>
                      <Card.Title className="mb-0">
                        Top At-Risk Students
                      </Card.Title>
                      <small className="text-muted">
                        Sorted by dropout probability (High → Low)
                      </small>
                    </div>
                    <OverlayTrigger
                      placement="left"
                      overlay={
                        <Tooltip id="dash-tip">
                          Dropout % and Deserving % come from your ML model
                          using marks, attendance, income & support features.
                        </Tooltip>
                      }
                    >
                      <span
                        className="badge bg-light text-secondary"
                        style={{ cursor: 'help' }}
                      >
                        ?
                      </span>
                    </OverlayTrigger>
                  </div>

                  {loading ? (
                    <div className="text-center my-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      <span className="text-muted">Loading data…</span>
                    </div>
                  ) : topRisk.length === 0 ? (
                    <p className="text-muted mt-3">
                      No risk data yet. Once you upload and score a batch, your
                      highest-risk students will appear here.
                    </p>
                  ) : (
                    <div className="mt-2">
                      {/* we reuse PredictionsTable but rows already include risk + scores */}
                      <PredictionsTable
  rows={topRisk.map((r) => ({
    ...r,
    dropout_probability: (
      Number(r.dropout_probability || 0) * 100
    ).toFixed(1),
    deservingness_score: Number(
      r.deservingness_score || 0
    ).toFixed(2),

    // ✅ NEW — always parsed explanation object
    explanation: parseExplanation(r.explanation),
  }))}
/>

                    </div>
                  )}

                  {/* quick legend below table */}
                  <div className="mt-3 small text-muted">
                    <span className="me-3">
                      <RiskBadge tier="HIGH" /> needs urgent support
                    </span>
                    <span className="me-3">
                      <RiskBadge tier="MEDIUM" /> monitor closely
                    </span>
                    <span>
                      <RiskBadge tier="LOW" /> stable, continue support
                    </span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
}
