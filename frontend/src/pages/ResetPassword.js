import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { getApiBaseUrl } from "../utils/config";

const postWithFallback = async (primaryUrl, fallbackUrl, payload) => {
  const baseUrl = getApiBaseUrl();
  const fullUrl = primaryUrl.startsWith("http") ? primaryUrl : `${baseUrl}${primaryUrl}`;
  try {
    return await axios.post(fullUrl, payload);
  } catch (err) {
    if (fallbackUrl && fallbackUrl !== primaryUrl) {
      const cleanFallback = fallbackUrl.replace(/^https?:\/\/[^\/]+/, "");
      const fullFallback = cleanFallback.startsWith("http") ? cleanFallback : `${baseUrl}${cleanFallback}`;
      console.warn(`Primary route ${fullUrl} failed (${err.message}), trying fallback ${fullFallback}`);
      return await axios.post(fullFallback, payload);
    }
    throw err;
  }
};

const getWithFallback = async (primaryUrl, fallbackUrl) => {
  const baseUrl = getApiBaseUrl();
  const fullUrl = primaryUrl.startsWith("http") ? primaryUrl : `${baseUrl}${primaryUrl}`;
  try {
    return await axios.get(fullUrl);
  } catch (err) {
    if (fallbackUrl && fallbackUrl !== primaryUrl) {
      const cleanFallback = fallbackUrl.replace(/^https?:\/\/[^\/]+/, "");
      const fullFallback = cleanFallback.startsWith("http") ? cleanFallback : `${baseUrl}${cleanFallback}`;
      return await axios.get(fullFallback);
    }
    throw err;
  }
};

// Crisp SVG Icons for Show/Hide Password
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// Evaluates password against: length, uppercase, lowercase, numbers, special characters
const evaluatePasswordStrength = (pwd) => {
  if (!pwd) {
    return {
      score: 0,
      label: "",
      color: "#64748b",
      percentage: 0,
      criteria: { length: false, uppercase: false, lowercase: false, number: false, special: false }
    };
  }

  const criteria = {
    length: pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd)
  };

  const count = Object.values(criteria).filter(Boolean).length;
  let label = "Weak";
  let color = "#ef4444";
  let percentage = 33;

  if (pwd.length >= 8 && count >= 4) {
    label = "Strong";
    color = "#10b981";
    percentage = 100;
  } else if (pwd.length >= 6 && count >= 2) {
    label = "Medium";
    color = "#f59e0b";
    percentage = 66;
  }

  return { score: count, label, color, percentage, criteria };
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const tokenParam = (searchParams.get("token") || "").trim();
  const emailParam = (searchParams.get("email") || "").trim();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [verifyingToken, setVerifyingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [accountEmail, setAccountEmail] = useState(emailParam);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const passwordStrength = evaluatePasswordStrength(newPassword);
  const isMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  // Verify token on component mount
  useEffect(() => {
    if (!tokenParam || tokenParam.length < 16) {
      setVerifyingToken(false);
      setTokenValid(false);
      setTokenError("Missing or invalid password reset link. Please request a new password reset from the login page.");
      return;
    }

    let isMounted = true;
    const verifyToken = async () => {
      try {
        const queryParams = `?token=${encodeURIComponent(tokenParam)}&email=${encodeURIComponent(emailParam)}`;
        const res = await getWithFallback(
          `/api/auth/verify-reset-token${queryParams}`,
          `/api/verify-reset-token${queryParams}`
        );

        if (!isMounted) return;

        if (res.data && res.data.valid) {
          setTokenValid(true);
          if (res.data.email) setAccountEmail(res.data.email);
        } else {
          setTokenValid(false);
          setTokenError(res.data?.error || "This password reset link is invalid or has expired.");
        }
      } catch (err) {
        if (!isMounted) return;
        // If verify endpoint returns 400 or fails, give graceful message
        const errMsg = err.response?.data?.error || "This password reset link has expired or has already been used. Please request a new one.";
        setTokenValid(false);
        setTokenError(errMsg);
      } finally {
        if (isMounted) setVerifyingToken(false);
      }
    };

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, [tokenParam, emailParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!newPassword || newPassword.length < 6) {
      setFormError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError("Passwords do not match. Please verify both fields.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await postWithFallback(
        "/api/auth/reset-password-with-token",
        "/api/reset-password-with-token",
        {
          email: accountEmail,
          token: tokenParam,
          newPassword
        }
      );

      if (res.data && res.data.success) {
        setFormSuccess("✅ Password reset successfully! Redirecting you to Sign In...");
        setTimeout(() => {
          navigate("/login", { replace: true });
        }, 2200);
      } else {
        setFormError(res.data?.error || "Failed to reset password. Please try again.");
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to reset password";
      setFormError(`❌ ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header Logo */}
        <div style={styles.header}>
          <div style={styles.logoBadge}>🛡️</div>
          <h1 style={styles.title}>Athena Smart Proctoring</h1>
          <p style={styles.subtitle}>Set New Account Password</p>
        </div>

        {/* Loading State during token verification */}
        {verifyingToken && (
          <div style={styles.stateContainer}>
            <div style={styles.spinner} />
            <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginTop: "16px" }}>
              Verifying your secure password reset link...
            </p>
          </div>
        )}

        {/* Token Invalid / Expired State */}
        {!verifyingToken && !tokenValid && (
          <div>
            <div style={styles.errorBanner}>
              <strong>⚠️ Link Expired or Invalid</strong>
              <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem", lineHeight: 1.4 }}>
                {tokenError}
              </p>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "20px" }}>
              For security, password reset links expire after 10 minutes and can only be used once.
            </p>

            <Link to="/login" style={styles.primaryLinkButton}>
              ← Return to Sign In & Request New Link
            </Link>
          </div>
        )}

        {/* Token Valid State: Password Reset Form */}
        {!verifyingToken && tokenValid && (
          <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "20px", textAlign: "center" }}>
              Resetting password for: <strong style={{ color: "#38bdf8" }}>{accountEmail}</strong>
            </p>

            {formError && <div style={styles.errorBanner}>{formError}</div>}
            {formSuccess && <div style={styles.successBanner}>{formSuccess}</div>}

            {/* New Password Input */}
            <div style={styles.formGroup}>
              <label style={styles.label}>New Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setFormError("");
                  }}
                  style={{ ...styles.input, paddingRight: "44px" }}
                  disabled={submitting || !!formSuccess}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  title={showNewPassword ? "Hide password" : "Show password"}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  style={styles.eyeButton}
                >
                  {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {newPassword.length > 0 && (
                <div style={styles.strengthContainer}>
                  <div style={styles.strengthHeader}>
                    <span style={styles.strengthLabel}>Password Strength</span>
                    <span style={{ ...styles.strengthCategory, color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div style={styles.strengthTrack}>
                    <div
                      style={{
                        ...styles.strengthFill,
                        width: `${passwordStrength.percentage}%`,
                        backgroundColor: passwordStrength.color,
                        boxShadow: `0 0 10px ${passwordStrength.color}55`
                      }}
                    />
                  </div>
                  <div style={styles.criteriaRow}>
                    <span style={{ ...styles.criteriaBadge, color: passwordStrength.criteria.length ? "#10b981" : "#64748b" }}>
                      {passwordStrength.criteria.length ? "✓" : "•"} 8+ Chars
                    </span>
                    <span style={{ ...styles.criteriaBadge, color: passwordStrength.criteria.uppercase ? "#10b981" : "#64748b" }}>
                      {passwordStrength.criteria.uppercase ? "✓" : "•"} Uppercase
                    </span>
                    <span style={{ ...styles.criteriaBadge, color: passwordStrength.criteria.lowercase ? "#10b981" : "#64748b" }}>
                      {passwordStrength.criteria.lowercase ? "✓" : "•"} Lowercase
                    </span>
                    <span style={{ ...styles.criteriaBadge, color: passwordStrength.criteria.number ? "#10b981" : "#64748b" }}>
                      {passwordStrength.criteria.number ? "✓" : "•"} Numbers
                    </span>
                    <span style={{ ...styles.criteriaBadge, color: passwordStrength.criteria.special ? "#10b981" : "#64748b" }}>
                      {passwordStrength.criteria.special ? "✓" : "•"} Special (!@#$)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password Input */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Confirm New Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setFormError("");
                  }}
                  style={{ ...styles.input, paddingRight: "44px" }}
                  disabled={submitting || !!formSuccess}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  style={styles.eyeButton}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>

              {/* Real-time Match Indicator */}
              {confirmPassword.length > 0 && (
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 500,
                    marginTop: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    color: isMatch ? "#10b981" : "#f87171"
                  }}
                >
                  {isMatch ? "✓ Passwords match" : "✕ Passwords do not match"}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !newPassword || newPassword.length < 6 || !isMatch || !!formSuccess}
              style={{
                ...styles.button,
                ...(submitting || !isMatch || newPassword.length < 6 || !!formSuccess ? styles.disabledButton : {})
              }}
            >
              {submitting ? "Updating Password..." : "Save Password & Proceed to Login ➔"}
            </button>

            <div style={{ textAlign: "center", marginTop: "18px" }}>
              <Link to="/login" style={styles.backLink}>
                ← Back to Login
              </Link>
            </div>
          </form>
        )}

        <div style={styles.footer}>
          🔒 End-to-end Encrypted & Athena AI Proctor Protected
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: "#070c18",
    padding: "20px"
  },
  card: {
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    backdropFilter: "blur(16px)",
    borderRadius: "20px",
    padding: "40px",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.5)",
    width: "100%",
    maxWidth: "460px",
    textAlign: "center"
  },
  header: {
    marginBottom: "24px"
  },
  logoBadge: {
    display: "inline-block",
    width: "56px",
    height: "56px",
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    borderRadius: "50%",
    lineHeight: "56px",
    fontSize: "26px",
    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
    marginBottom: "12px"
  },
  title: {
    fontSize: "1.6rem",
    fontWeight: 700,
    background: "linear-gradient(135deg, #818cf8, #c084fc)",
    WebkitBackgroundClip: "text",
    color: "transparent",
    margin: "0 0 4px 0"
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "0.85rem",
    margin: 0
  },
  stateContainer: {
    padding: "30px 10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid rgba(99, 102, 241, 0.2)",
    borderTopColor: "#818cf8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite"
  },
  formGroup: {
    marginBottom: "20px"
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#cbd5e1",
    fontWeight: 500,
    fontSize: "0.85rem"
  },
  input: {
    width: "100%",
    padding: "14px 16px",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "12px",
    color: "#f1f5f9",
    fontSize: "0.95rem",
    outline: "none",
    boxSizing: "border-box"
  },
  eyeButton: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  button: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
    marginTop: "6px",
    boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)"
  },
  disabledButton: {
    opacity: 0.6,
    cursor: "not-allowed"
  },
  primaryLinkButton: {
    display: "inline-block",
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    color: "white",
    borderRadius: "12px",
    fontSize: "0.92rem",
    fontWeight: 600,
    textDecoration: "none",
    boxSizing: "border-box"
  },
  backLink: {
    color: "#94a3b8",
    fontSize: "0.85rem",
    textDecoration: "none"
  },
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    color: "#fca5a5",
    padding: "12px 14px",
    borderRadius: "10px",
    fontSize: "0.85rem",
    marginBottom: "18px",
    textAlign: "left"
  },
  successBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    border: "1px solid rgba(16, 185, 129, 0.4)",
    color: "#6ee7b7",
    padding: "12px 14px",
    borderRadius: "10px",
    fontSize: "0.85rem",
    marginBottom: "18px",
    textAlign: "left"
  },
  strengthContainer: {
    marginTop: "8px",
    padding: "10px 12px",
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid #1e293b",
    borderRadius: "8px"
  },
  strengthHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px"
  },
  strengthLabel: {
    fontSize: "0.75rem",
    color: "#94a3b8",
    fontWeight: 500
  },
  strengthCategory: {
    fontSize: "0.75rem",
    fontWeight: 700
  },
  strengthTrack: {
    height: "4px",
    backgroundColor: "#1e293b",
    borderRadius: "2px",
    overflow: "hidden",
    marginBottom: "8px"
  },
  strengthFill: {
    height: "100%",
    transition: "all 0.3s ease"
  },
  criteriaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px"
  },
  criteriaBadge: {
    fontSize: "0.68rem",
    fontWeight: 600,
    transition: "color 0.2s ease"
  },
  footer: {
    marginTop: "24px",
    fontSize: "0.75rem",
    color: "#64748b"
  }
};
