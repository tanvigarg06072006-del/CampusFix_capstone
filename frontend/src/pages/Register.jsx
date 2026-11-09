import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../firebase";
import { Link, useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName || cleanName.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    if (password.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      if (cleanName) {
        await updateProfile(userCredential.user, { displayName: cleanName });
        await userCredential.user.getIdToken(true);
      }

      navigate("/user", { replace: true });
    } catch (err) {
      console.error("REGISTRATION ERROR:", err.code, err.message);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in instead.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid university email address.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use letters and numbers.");
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-card-top">
          <div className="auth-logo-badge">
            <span>🎓</span>
          </div>
          <h1 className="auth-portal-title">CampusFix</h1>
          <h2 className="auth-sub-title">Create Student Account</h2>
          <p className="auth-desc">
            Register to report campus maintenance issues, track resolution, and collaborate with administration.
          </p>
        </div>

        {error && (
          <div className="inline-banner banner-error">
            <span>⚠️ {error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group">
            <label htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              type="text"
              placeholder="e.g. Alex Johnson"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              type="email"
              placeholder="e.g. alex@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              placeholder="Choose a password (min. 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
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
            {loading ? "Creating Account..." : "Register Account"}
          </button>
        </form>

        <div className="auth-card-footer">
          <p className="switch-auth-text">
            Already have an account?{" "}
            <Link to="/login/user" className="auth-link">
              Sign in here
            </Link>
          </p>

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

export default Register;
