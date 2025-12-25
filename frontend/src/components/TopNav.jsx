// src/components/TopNav.jsx
import React, { useState } from "react";
import {
  Navbar,
  Container,
  Nav,
  Dropdown,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import { useNavigate, useLocation } from "react-router-dom";

export default function TopNav() {
  const nav = useNavigate();
  const location = useLocation();
  const activePath = location.pathname;

  const [expanded, setExpanded] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // ---- FIXED: Safely parse user JSON ----
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem("deserveiq_user"));
  } catch (e) {
    saved = null;
  }

  const username = saved?.email?.split("@")[0] || "Admin";

  const logout = () => {
    localStorage.removeItem("deserveiq_user");
    nav("/login");
  };

  const navLinkStyle = (path) => ({
    cursor: "pointer",
    fontWeight: 500,
    color: activePath === path ? "#fff" : "rgba(255,255,255,0.8)",
    textDecoration: "none",
    position: "relative",
    transition: "color 0.3s ease",
  });

  return (
    <Navbar
      expand="lg"
      expanded={expanded}
      className="shadow-sm px-3"
      style={{
        background:
          "linear-gradient(90deg, #0ea5e9 0%, #6366f1 60%, #8b5cf6 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        fontFamily: '"Inter", sans-serif',
        zIndex: 1000,
      }}
    >
      <Container fluid>
        {/* Brand */}
        <Navbar.Brand
          onClick={() => nav("/")}
          style={{
            cursor: "pointer",
            color: "white",
            fontWeight: 700,
            fontSize: "1.5rem",
            letterSpacing: "-0.5px",
          }}
        >
          <i className="bi bi-stars me-2"></i>
          DeserveIQ
        </Navbar.Brand>

        {/* Mobile Toggle */}
        <Navbar.Toggle
          aria-controls="basic-navbar-nav"
          onClick={() => setExpanded((prev) => !prev)}
          style={{ borderColor: "rgba(255,255,255,0.7)" }}
        >
          <i
            className="bi bi-list"
            style={{ fontSize: "1.6rem", color: "white" }}
          ></i>
        </Navbar.Toggle>

        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-lg-center" style={{ columnGap: 15 }}>
            {[
              { label: "Single Predict", path: "/predict" },
              { label: "Batch Upload", path: "/batch" },
              { label: "Students", path: "/students" },
            ].map((item, idx) => (
              <OverlayTrigger
                key={idx}
                placement="bottom"
                overlay={<Tooltip>Go to {item.label}</Tooltip>}
              >
                <Nav.Link
                  onClick={() => {
                    nav(item.path);
                    setExpanded(false);
                  }}
                  style={navLinkStyle(item.path)}
                  className="nav-hover"
                >
                  {item.label}
                  {activePath === item.path && (
                    <div
                      style={{
                        height: "2px",
                        width: "100%",
                        background: "white",
                        position: "absolute",
                        bottom: "-2px",
                        left: 0,
                        borderRadius: 12,
                        animation: "slideIn 0.3s ease",
                      }}
                    />
                  )}
                </Nav.Link>
              </OverlayTrigger>
            ))}

            {/* Profile Dropdown */}
            <Dropdown
              drop="down"
              show={profileOpen}
              onToggle={(isOpen) => setProfileOpen(isOpen)}
              className="ms-3"
            >
              <Dropdown.Toggle
                as="div"
                style={{
                  cursor: "pointer",
                  color: "white",
                  fontWeight: 600,
                  padding: "6px 12px",
                  borderRadius: "27px",
                  border: "2px solid rgba(255,255,255,0.4)",
                  display: "flex",
                  alignItems: "center",
                  transition: "all 0.2s ease",
                }}
              >
                <i className="bi bi-person-circle me-2"></i>
                {username}
              </Dropdown.Toggle>

              <Dropdown.Menu
                align="end"
                className="shadow"
                style={{
                  borderRadius: 16,
                  border: "none",
                  marginTop: 8,
                  minWidth: 200,
                  background: "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(15px)",
                  WebkitBackdropFilter: "blur(15px)",
                }}
              >
                <Dropdown.Item
                  onClick={() => nav("/")}
                  style={{ borderRadius: 12, fontWeight: 500 }}
                >
                  <i className="bi bi-speedometer2 me-2 text-primary" />
                  Dashboard
                </Dropdown.Item>

                <Dropdown.Item
                  onClick={() => nav("/students")}
                  style={{ borderRadius: 12, fontWeight: 500 }}
                >
                  <i className="bi bi-people-fill me-2 text-success" />
                  Students
                </Dropdown.Item>

                <Dropdown.Divider />

                <Dropdown.Item
                  onClick={logout}
                  className="text-danger"
                  style={{
                    fontWeight: 700,
                    borderRadius: 12,
                  }}
                >
                  <i className="bi bi-box-arrow-right me-2" />
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>

      <style>
        {`
          .nav-hover:hover {
            color: #fff !important;
            opacity: 1 !important;
          }
          @keyframes slideIn {
            from { width: 0%; }
            to { width: 100%; }
          }
        `}
      </style>
    </Navbar>
  );
}
