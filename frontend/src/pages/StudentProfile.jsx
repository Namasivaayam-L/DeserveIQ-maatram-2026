// src/pages/StudentProfile.jsx
import React, { useEffect, useMemo, useState } from 'react';
import TopNav from '../components/TopNav';
import {
  Container,
  Card,
  Row,
  Col,
  Badge,
  Spinner,
  ListGroup,
  ProgressBar,
} from 'react-bootstrap';
import { getStudent, predictSingle } from '../services/api';
import { useParams } from 'react-router-dom';

const headerGradient =
  'linear-gradient(135deg, rgba(239,246,255,1) 0%, rgba(221,239,253,1) 40%, rgba(219,234,254,1) 100%)';

const chipStyle = {
  borderRadius: 999,
  padding: '3px 10px',
  backgroundColor: '#eff6ff',
  fontSize: '0.7rem',
  fontWeight: 500,
  marginRight: 6,
  marginBottom: 6,
  display: 'inline-block',
};

const RiskPill = ({ tier }) => {
  if (!tier) return null;
  const upper = String(tier).toUpperCase();
  const map = {
    HIGH: { variant: 'danger', label: 'High Risk' },
    MEDIUM: { variant: 'warning', label: 'Medium Risk' },
    LOW: { variant: 'success', label: 'Low Risk' },
  };
  const cfg = map[upper] || { variant: 'secondary', label: upper };

  return (
    <Badge bg={cfg.variant} pill className="ms-2">
      {cfg.label}
    </Badge>
  );
};

const Gauge = ({ label, value, suffix = '', variant = 'info' }) => {
  const numeric = Number(value) || 0;
  const safe = Math.max(0, Math.min(100, numeric));

  return (
    <div className="mb-3">
      <div className="d-flex justify-content-between">
        <span className="small text-muted">{label}</span>
        <span className="small">
          <strong>{safe.toFixed(1)}</strong>
          {suffix}
        </span>
      </div>
      <ProgressBar
        now={safe}
        variant={variant}
        style={{ height: 8 }}
        className="rounded-pill"
      />
    </div>
  );
};

// -------- explanation parser (same logic as Students.jsx) ----------
const parseExplanation = (raw) => {
  if (!raw) return null;

  let obj = null;

  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { raw };
    }
  } else if (typeof raw === 'object') {
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
    const s = String(v).replace(/^\[|\]$/g, '');
    return s
      .split(',')
      .map((x) => x.trim().replace(/^['"]|['"]$/g, ''))
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
      obj.human_readable_reasons || obj.reasons
    ),
  };
};

export default function StudentProfile() {
  const { id } = useParams();
  const [s, setS] = useState(null);
  const [pred, setPred] = useState(null);
  const [loading, setLoading] = useState(true);

  const buildPayloadFromStudent = (stu) => {
    const { id, ...rest } = stu;
    return rest;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const stu = await getStudent(id);
        setS(stu);

        try {
          const payload = buildPayloadFromStudent(stu);
          const p = await predictSingle(payload);
          setPred({
  dropout_probability: Number(p.dropout_probability),
  deservingness_score: Number(p.deservingness_score),
  risk_tier: p.risk_tier,
  explanation: p.explanation ?? p.explanation_json ?? null,
});

        } catch (e) {
          console.error('Prediction error', e);
          setPred(null);
        }
      } catch (e) {
        console.error(e);
        setS(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const derived = useMemo(() => {
    if (!s) {
      return {
        attendance: 0,
        academic: 0,
        motivation: 0,
      };
    }
    return {
      attendance: Number(s.attendance_rate ?? s.attendanceRate ?? 0),
      academic: Number(s.academic_score ?? s.academicScore ?? 0),
      motivation: Number(s.motivation_level ?? s.motivational_score ?? 0),
    };
  }, [s]);

 const explanation = useMemo(() => {
  if (!pred) return null;
  return parseExplanation(
    pred.explanation ??
      pred.explanation_json ??
      pred.explanationJson ??
      null
  );
}, [pred]);



  if (loading) {
    return (
      <>
        <TopNav />
        <Container className="p-4">
          <Card className="p-4 text-center shadow-sm">
            <Spinner animation="border" className="me-2" />
            Loading student profile…
          </Card>
        </Container>
      </>
    );
  }

  if (!s) {
    return (
      <>
        <TopNav />
        <Container className="p-4">
          <Card className="p-4 text-center shadow-sm">
            Unable to load student profile.
          </Card>
        </Container>
      </>
    );
  }

  const riskVariant =
    pred?.risk_tier === 'HIGH'
      ? 'danger'
      : pred?.risk_tier === 'MEDIUM'
      ? 'warning'
      : 'success';

  const dropoutPct = pred
    ? (Number(pred.dropout_probability || 0) * 100).toFixed(1)
    : '0.0';

  const deservingScore = pred
    ? Number(pred.deservingness_score || 0).toFixed(2)
    : '0.00';

  return (
    <>
      <TopNav />
      <div
        style={{
          minHeight: '100vh',
          background:
            'linear-gradient(180deg, #eff6ff 0%, #ffffff 40%, #f9fafb 100%)',
          fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont',
        }}
      >
        <Container className="py-4">
          {/* header block */}
          <Row className="mb-3">
            <Col>
              <Card
                className="border-0 shadow-sm"
                style={{ borderRadius: 18, background: headerGradient }}
              >
                <Card.Body>
                  <Row className="align-items-center g-3">
                    <Col md={8}>
                      <div className="d-flex align-items-center flex-wrap">
                        <div className="me-3">
                          <h3
                            className="mb-0"
                            style={{
                              color: '#111827',
                              fontWeight: 700,
                              letterSpacing: 0.2,
                            }}
                          >
                            {s.name || 'Student'}
                          </h3>
                          <div className="small text-muted">
                            {s.district || 'District N/A'}
                          </div>
                        </div>
                        {pred && <RiskPill tier={pred.risk_tier} />}
                      </div>
                      <div className="mt-3">
                        {s.private_or_govt_school && (
                          <span style={chipStyle}>
                            {s.private_or_govt_school}
                          </span>
                        )}
                        {s.school_type_12 && (
                          <span style={chipStyle}>
                            12th: {s.school_type_12}
                          </span>
                        )}
                        {s.first_graduate && (
                          <span style={chipStyle}>
                            First graduate: {s.first_graduate}
                          </span>
                        )}
                        {s.any_scholarship && (
                          <span style={chipStyle}>
                            Scholarship: {s.any_scholarship}
                          </span>
                        )}
                      </div>
                    </Col>
                    <Col md={4}>
                      <Card
                        className="border-0 shadow-sm"
                        style={{ borderRadius: 16 }}
                      >
                        <Card.Body className="py-3">
                          <div className="small text-muted mb-1">
                            Dropout probability
                          </div>
                          <h4 className="mb-0" style={{ color: '#111827' }}>
                            {dropoutPct}%
                          </h4>
                          <ProgressBar
                            className="mt-2 rounded-pill"
                            now={Number(dropoutPct)}
                            variant={riskVariant}
                            style={{ height: 8 }}
                          />
                          <div className="mt-3 small text-muted">
                            Deservingness score:{' '}
                            <span
                              style={{
                                fontWeight: 700,
                                color: '#16a34a',
                              }}
                            >
                              {deservingScore}
                            </span>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="g-4">
            {/* LEFT COLUMN */}
            <Col lg={4}>
              <Card className="shadow-sm border-0" style={{ borderRadius: 18 }}>
                <Card.Body>
                  <Card.Title>Family & Background</Card.Title>
                  <ListGroup variant="flush" className="mt-2 small">
                    <ListGroup.Item>
                      <strong>Parents occupation:</strong>{' '}
                      {s.parents_occupation || 'N/A'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Family income:</strong>{' '}
                      {s.family_income ?? s.familyIncome ?? 'N/A'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Family members:</strong>{' '}
                      {s.family_members ?? s.familyMembers ?? 'N/A'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Girl child:</strong>{' '}
                      {s.girl_child || 'Not specified'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Orphan / Single parent:</strong>{' '}
                      {s.orphan === 'Yes'
                        ? 'Orphan'
                        : s.single_parent === 'Yes'
                        ? 'Single parent'
                        : 'No'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Rent / Own:</strong>{' '}
                      {s.rent_or_own || 'Not specified'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Property owned:</strong>{' '}
                      {s.property_owned || 'Not specified'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>School fee (6–12):</strong>{' '}
                      {s.school_fee_6_to_12 || 'N/A'}
                    </ListGroup.Item>
                  </ListGroup>
                </Card.Body>
              </Card>

              <Card
                className="shadow-sm border-0 mt-3"
                style={{ borderRadius: 18 }}
              >
                <Card.Body>
                  <Card.Title>Support Factors</Card.Title>
                  <ListGroup variant="flush" className="mt-2 small">
                    <ListGroup.Item>
                      <strong>Family support:</strong>{' '}
                      {s.family_support || 'N/A'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Communication frequency:</strong>{' '}
                      {s.communication_frequency || 'N/A'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Extra-curricular:</strong>{' '}
                      {s.extra_curricular || 'N/A'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Interest level:</strong>{' '}
                      {s.interest_level || 'N/A'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Attitude:</strong> {s.attitude || 'N/A'}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <strong>Willing to stay in hostel:</strong>{' '}
                      {s.willing_hostel || 'N/A'}
                    </ListGroup.Item>
                  </ListGroup>
                </Card.Body>
              </Card>
            </Col>

            {/* RIGHT COLUMN */}
            <Col lg={8}>
              <Row className="g-3">
                <Col md={6}>
                  <Card
                    className="shadow-sm border-0 h-100"
                    style={{ borderRadius: 18 }}
                  >
                    <Card.Body>
                      <Card.Title>Academic Snapshot</Card.Title>
                      <div className="mt-3">
                        <Gauge
                          label="Academic score"
                          value={derived.academic}
                          suffix="/100"
                          variant="primary"
                        />
                        <Gauge
                          label="Motivation level"
                          value={((derived.motivation || 0) / 5) * 100 || 0}
                          suffix="/100"
                          variant="info"
                        />
                        <Gauge
                          label="Attendance rate"
                          value={derived.attendance}
                          suffix="%"
                          variant="success"
                        />
                      </div>

                      <div className="mt-3 small text-muted">
                        Marks history:
                      </div>
                      <ul className="small text-muted mb-0">
                        <li>10th: {s.marks_10 ?? s.marks10 ?? 'N/A'}</li>
                        <li>11th: {s.marks_11 ?? s.marks11 ?? 'N/A'}</li>
                        <li>12th: {s.marks_12 ?? s.marks12 ?? 'N/A'}</li>
                      </ul>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6}>
                  <Card
                    className="shadow-sm border-0 h-100"
                    style={{ borderRadius: 18 }}
                  >
                    <Card.Body>
                      <Card.Title>Risk & Deservingness</Card.Title>

                      {pred ? (
                        <>
                          <div className="mt-3">
                            <Gauge
                              label="Modelled dropout probability"
                              value={Number(dropoutPct)}
                              suffix="%"
                              variant={riskVariant}
                            />
                            <Gauge
                              label="Deservingness score"
                              value={Number(deservingScore)}
                              suffix="/100"
                              variant="success"
                            />
                          </div>

                          {/* Explanation from stored explanation JSON */}
                          <div className="mt-3">
                            <div className="small text-muted mb-1">
                              Explanation (model + rules)
                            </div>

                            {!explanation ? (
                              <p className="small text-muted mb-0">
                                No stored explanation for this student.
                              </p>
                            ) : explanation.raw ? (
                              <pre
                                className="small"
                                style={{
                                  background: '#f3f4f6',
                                  padding: 10,
                                  borderRadius: 10,
                                  fontSize: '0.75rem',
                                }}
                              >
                                {explanation.raw}
                              </pre>
                            ) : (
                              <>
                                <Row className="mb-2">
                                  <Col xs={12}>
                                    <div className="d-flex flex-wrap small">
                                      <span className="me-3 mb-1">
                                        <strong>Final:</strong>{' '}
                                        {explanation.final_probability_used !=
                                        null
                                          ? (
                                              explanation.final_probability_used *
                                              100
                                            ).toFixed(1) + '%'
                                          : 'N/A'}
                                      </span>
                                      <span className="me-3 mb-1">
                                        <strong>Model:</strong>{' '}
                                        {explanation.model_probability != null
                                          ? (
                                              explanation.model_probability *
                                              100
                                            ).toFixed(1) + '%'
                                          : 'N/A'}
                                      </span>
                                      <span className="mb-1">
                                        <strong>Rule:</strong>{' '}
                                        {explanation.rule_probability != null
                                          ? (
                                              explanation.rule_probability *
                                              100
                                            ).toFixed(1) + '%'
                                          : 'N/A'}
                                      </span>
                                    </div>
                                  </Col>
                                </Row>

                                <div className="mb-2">
                                  <div className="small text-muted mb-1">
                                    Top influencing features
                                  </div>
                                  {explanation.global_top_model_features
                                    .length > 0 ? (
                                    <div className="mb-1">
                                      {explanation.global_top_model_features.map(
                                        (f, i) => (
                                          <Badge
                                            bg="light"
                                            text="dark"
                                            className="me-2 mb-2"
                                            key={i}
                                            style={{
                                              borderRadius: 999,
                                              fontSize: '0.7rem',
                                            }}
                                          >
                                            {f}
                                          </Badge>
                                        )
                                      )}
                                    </div>
                                  ) : (
                                    <p className="small text-muted mb-1">
                                      Not provided.
                                    </p>
                                  )}
                                </div>

                                <div>
                                  <div className="small text-muted mb-1">
                                    Human-readable reasons
                                  </div>
                                  {explanation.human_readable_reasons.length >
                                  0 ? (
                                    <ul className="small text-muted mb-0">
                                      {explanation.human_readable_reasons.map(
                                        (r, i) => (
                                          <li key={i}>{r}</li>
                                        )
                                      )}
                                    </ul>
                                  ) : (
                                    <p className="small text-muted mb-0">
                                      Not provided.
                                    </p>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-muted mt-3">
                          Prediction not available for this student. Ensure the
                          ML service is running and try reloading the page.
                        </p>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
}
