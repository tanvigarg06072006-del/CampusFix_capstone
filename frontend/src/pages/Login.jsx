import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "firebase/auth";
import { auth } from "../firebase";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getCurrentUser } from "../utils/complaints";

function Login() {
  const { role } = useParams();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = role === "admin";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setInfoMessage("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);

      const profile = await getCurrentUser();

      if (isAdmin && profile.role !== "admin") {
        await signOut(auth);
        setError("Access denied: This account does not have administrator privileges.");
        return;
      }

      if (!isAdmin && profile.role === "admin") {
        await signOut(auth);
        setError("This account is an Administrator. Please use the Admin Portal login.");
        return;
      }

      navigate(profile.role === "admin" ? "/admin" : "/user", { replace: true });
    } catch (err) {
      console.error("FIREBASE LOGIN ERROR:", err.code, err.message);

      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Invalid email address or password. Please verify and try again.");
      } else if (err.code === "auth/user-not-found") {
        setError("No account found with this email. Please create an account first.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/network-request-failed") {
        setError("Network connection failed. Please check your internet connection.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please wait a few minutes before retrying.");
      } else if (err.code === "auth/user-disabled") {
        setError("This account has been disabled. Please contact the campus admin.");
      } else {
        setError(err.message || "Failed to sign in. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Please type your email address above to receive a password reset link.");
      return;
    }

    setError("");
    setInfoMessage("");

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setInfoMessage("A password reset link has been sent to your email inbox.");
    } catch (err) {
      console.error("PASSWORD RESET ERROR:", err);
      setError("Unable to send reset email. Ensure the address is correct.");
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-card-top">
          <div className="auth-logo-badge">
            <span>{isAdmin ? "⚙️" : "🎓"}</span>
          </div>
          <h1 className="auth-portal-title">CampusFix</h1>
          <h2 className="auth-sub-title">
            {isAdmin ? "Admin Login" : "Student Login"}
          </h2>
          <p className="auth-desc">
            {isAdmin
              ? "Sign in to review and manage campus maintenance requests."
              : "Sign in to submit complaints and track resolution status."}
          </p>
        </div>

        {error && (
          <div className="inline-banner banner-error">
            <span>⚠️ {error}</span>
          </div>
        )}

        {infoMessage && (
          <div className="inline-banner banner-success">
            <span>✓ {infoMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              placeholder="e.g. name@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <div className="label-with-action">
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                className="btn-link"
                onClick={handleForgotPassword}
              >
                Forgot Password?
              </button>
            </div>
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            <span>Show password</span>
          </label>

          <button
            type="submit"
            className="btn-primary btn-block"
            disabled={loading}
          >
            {loading ? "Authenticating..." : `Sign In as ${isAdmin ? "Admin" : "Student"}`}
          </button>
        </form>

        <div className="auth-card-footer">
          {!isAdmin && (
            <p className="switch-auth-text">
              Don't have a student account?{" "}
              <Link to="/register" className="auth-link">
                Register here
              </Link>
            </p>
          )}

          <div className="footer-links-row">
            <Link to="/" className="back-link">
              ← Return to Role Selection
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
