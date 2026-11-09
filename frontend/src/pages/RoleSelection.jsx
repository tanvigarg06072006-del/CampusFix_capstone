import { useNavigate } from "react-router-dom";

export default function RoleSelection() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="brand-logo">
          <span className="logo-icon">🏢</span>
          <span className="brand-title">CampusFix</span>
        </div>
        <span className="system-status-pill">
          <span className="pulse-dot"></span> System Operational
        </span>
      </header>

      <main className="landing-hero">
        <div className="hero-content">
          <span className="hero-eyebrow">Campus Issue Resolution Portal</span>
          <h1 className="hero-heading">
            Resolve Campus Issues <span className="text-highlight">Faster & Together</span>
          </h1>
          <p className="hero-subtitle">
            A centralized system for students to report maintenance, facility, and campus infrastructure concerns,
            and for administrators to track and resolve them systematically.
          </p>

          <div className="role-selection-grid">
            <div
              className="role-card card-student"
              onClick={() => navigate("/login/user")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/login/user")}
            >
              <div className="role-card-header">
                <div className="role-icon-box student-icon-box">🎓</div>
                <span className="role-tag student-tag">For Students</span>
              </div>
              <h2>Student Portal</h2>
              <p>
                Report infrastructure problems, attach photos, support peers facing the same issues,
                and receive real-time resolution updates.
              </p>
              <ul className="role-feature-list">
                <li>✓ Quick complaint filing with photo proof</li>
                <li>✓ Real-time status & activity trail</li>
                <li>✓ "Me-Too" community problem upvoting</li>
              </ul>
              <button
                type="button"
                className="btn-role-action btn-student"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/login/user");
                }}
              >
                Enter as Student →
              </button>
            </div>

            <div
              className="role-card card-admin"
              onClick={() => navigate("/login/admin")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/login/admin")}
            >
              <div className="role-card-header">
                <div className="role-icon-box admin-icon-box">⚙️</div>
                <span className="role-tag admin-tag">Staff / Authorities</span>
              </div>
              <h2>Admin Portal</h2>
              <p>
                Triage submitted issues, assign departments, prioritize urgent repairs,
                communicate directly with reporters, and monitor analytics.
              </p>
              <ul className="role-feature-list">
                <li>✓ Department routing & priority management</li>
                <li>✓ Complete complaint lifecycle management</li>
                <li>✓ Direct messaging & status updates</li>
              </ul>
              <button
                type="button"
                className="btn-role-action btn-admin"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/login/admin");
                }}
              >
                Enter as Administrator →
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <p>© CampusFix • University Campus Maintenance & Operations Portal</p>
      </footer>
    </div>
  );
}
