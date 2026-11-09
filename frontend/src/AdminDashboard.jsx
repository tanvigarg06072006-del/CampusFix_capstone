import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";

import {
  complaintMatchesFilters,
  getComplaints,
  updateComplaint,
  getNotifications,
  markNotificationRead,
  getDepartments,
  addDepartment,
  assignDepartment,
  updatePriority,
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES
} from "./utils/complaints";
import ComplaintComments from "./components/ComplaintComments";
import ComplaintTimeline from "./components/ComplaintTimeline";

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Navigation tab
  const [activeTab, setActiveTab] = useState("complaints");

  // Data states
  const [complaints, setComplaints] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Filter states
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  // Department creation states
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentDesc, setNewDepartmentDesc] = useState("");
  const [departmentActionMsg, setDepartmentActionMsg] = useState({ type: "", text: "" });
  const [creatingDept, setCreatingDept] = useState(false);

  // In-app feedback banner (replaces browser alerts)
  const [actionFeedback, setActionFeedback] = useState({ type: "", text: "" });

  // Lightbox preview for photos
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const complaintsRequest = useRef(0);

  // Load complaints and departments periodically
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      const requestId = ++complaintsRequest.current;

      try {
        const [complaintsData, deptData, notes] = await Promise.all([
          getComplaints(),
          getDepartments(),
          getNotifications()
        ]);

        if (isMounted && requestId === complaintsRequest.current) {
          setComplaints(complaintsData);
          setDepartments(deptData);
          setNotifications(notes);
        }
      } catch (error) {
        console.error("Error loading admin data:", error);
      }
    };

    loadData();
    const intervalId = setInterval(loadData, 6000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  // Update Status handler
  async function handleChangeStatus(id, newStatus) {
    try {
      setActionFeedback({ type: "info", text: `Updating complaint #${id} status...` });
      await updateComplaint(id, { status: newStatus });

      setComplaints((current) =>
        current.map((item) =>
          String(item.id) === String(id) ? { ...item, status: newStatus } : item
        )
      );

      setActionFeedback({
        type: "success",
        text: `Complaint #${id} status changed to ${newStatus}.`
      });

      setTimeout(() => setActionFeedback({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error(error);
      setActionFeedback({
        type: "error",
        text: error.message || "Failed to update complaint status."
      });
    }
  }

  // Update Priority handler
  async function handleChangePriority(id, newPriority) {
    const previous = complaints.find((item) => String(item.id) === String(id));

    complaintsRequest.current += 1;
    setComplaints((current) =>
      current.map((item) =>
        String(item.id) === String(id) ? { ...item, priority: newPriority } : item
      )
    );

    try {
      setActionFeedback({ type: "info", text: `Updating complaint #${id} priority...` });
      const updated = await updatePriority(id, newPriority);
      const savedPriority = updated?.priority
        ? updated.priority.charAt(0) + updated.priority.slice(1).toLowerCase()
        : newPriority;

      setComplaints((current) =>
        current.map((item) =>
          String(item.id) === String(id) ? { ...item, priority: savedPriority } : item
        )
      );

      setActionFeedback({
        type: "success",
        text: `Complaint #${id} priority set to ${newPriority}.`
      });
      setTimeout(() => setActionFeedback({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error(error);
      setComplaints((current) =>
        current.map((item) =>
          previous && String(item.id) === String(id)
            ? { ...item, priority: previous.priority }
            : item
        )
      );
      setActionFeedback({
        type: "error",
        text: error.message || "Failed to update priority."
      });
    }
  }

  // Assign Department handler
  async function handleChangeDepartment(id, departmentId) {
    const selected = departments.find(
      (dept) => String(dept.id) === String(departmentId)
    );
    const previous = complaints.find((item) => String(item.id) === String(id));

    complaintsRequest.current += 1;
    setComplaints((current) =>
      current.map((item) => {
        if (String(item.id) !== String(id)) return item;
        return {
          ...item,
          departmentId: departmentId || "",
          departmentName: departmentId ? (selected?.name || "") : ""
        };
      })
    );

    try {
      setActionFeedback({ type: "info", text: `Updating department assignment for #${id}...` });
      const updated = await assignDepartment(id, departmentId);
      const savedId = updated?.department_id == null ? "" : String(updated.department_id);
      const savedName = updated?.department_name || (departmentId ? selected?.name : "") || "";

      setComplaints((current) =>
        current.map((item) =>
          String(item.id) === String(id)
            ? { ...item, departmentId: savedId, departmentName: savedName }
            : item
        )
      );

      setActionFeedback({
        type: "success",
        text: departmentId
          ? `Complaint #${id} assigned to ${savedName}.`
          : `Department assignment removed for #${id}.`
      });
      setTimeout(() => setActionFeedback({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error(error);
      setComplaints((current) =>
        current.map((item) =>
          previous && String(item.id) === String(id)
            ? {
                ...item,
                departmentId: previous.departmentId || "",
                departmentName: previous.departmentName || ""
              }
            : item
        )
      );
      setActionFeedback({
        type: "error",
        text: error.message || "Failed to assign department."
      });
    }
  }

  // Create Department handler (No browser alert)
  async function handleCreateDepartment(e) {
    e.preventDefault();
    const cleanName = newDepartmentName.trim();
    if (!cleanName) return;

    try {
      setCreatingDept(true);
      setDepartmentActionMsg({ type: "", text: "" });

      await addDepartment(cleanName, newDepartmentDesc.trim());
      setNewDepartmentName("");
      setNewDepartmentDesc("");

      const updatedDepts = await getDepartments();
      setDepartments(updatedDepts);

      setDepartmentActionMsg({
        type: "success",
        text: `Department "${cleanName}" added successfully!`
      });
      setTimeout(() => setDepartmentActionMsg({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error(error);
      setDepartmentActionMsg({
        type: "error",
        text: error.message || "Could not add department."
      });
    } finally {
      setCreatingDept(false);
    }
  }

  // Mark notification read
  async function handleNotificationRead(id) {
    try {
      await markNotificationRead(id);
      setNotifications((previous) =>
        previous.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error("Could not mark notification read:", error);
    }
  }

  function resetFilters() {
    setSearch("");
    setFilter("All");
    setDepartmentFilter("All");
    setCategoryFilter("All");
    setPriorityFilter("All");
  }

  async function logout() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      sessionStorage.clear();
      navigate("/", { replace: true });
    }
  }

  function formatDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  // Metric counts
  const totalCount = complaints.length;
  const newCount = complaints.filter((c) => c.status === "Pending").length;
  const progressCount = complaints.filter((c) => c.status === "In Progress").length;
  const resolvedCount = complaints.filter((c) => c.status === "Resolved").length;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filteredComplaints = complaints.filter((item) =>
    complaintMatchesFilters(item, {
      search,
      status: filter,
      department: departmentFilter,
      category: categoryFilter,
      priority: priorityFilter
    })
  );

  return (
    <div className="dashboard-layout">
      {/* Top Header */}
      <header className="app-nav-header">
        <div className="nav-brand-section">
          <div className="brand-badge-box">🏢</div>
          <div>
            <span className="brand-name">CampusFix</span>
            <span className="badge-role-pill admin-pill">Administrator Portal</span>
          </div>
        </div>

        <div className="nav-user-actions">
          <div className="user-profile-widget">
            <div className="avatar-pill avatar-admin">A</div>
            <div className="user-details-text">
              <span className="user-display-name">Campus Administrator</span>
              <span className="user-display-email">admin@campusfix.edu</span>
            </div>
          </div>

          <button onClick={logout} className="btn-logout" title="Sign out">
            Logout
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="dashboard-shell">
        {/* Metric Cards Banner */}
        <section className="metrics-strip">
          <div className="metric-box">
            <span className="metric-label">Total Complaints</span>
            <strong className="metric-value">{totalCount}</strong>
          </div>
          <div className="metric-box metric-pending">
            <span className="metric-label">Pending / New</span>
            <strong className="metric-value">{newCount}</strong>
          </div>
          <div className="metric-box metric-progress">
            <span className="metric-label">In Progress</span>
            <strong className="metric-value">{progressCount}</strong>
          </div>
          <div className="metric-box metric-resolved">
            <span className="metric-label">Resolved</span>
            <strong className="metric-value">{resolvedCount}</strong>
          </div>
        </section>

        {/* Global Action Feedback (replaces browser alerts) */}
        {actionFeedback.text && (
          <div className={`inline-banner banner-${actionFeedback.type}`}>
            <span>
              {actionFeedback.type === "success"
                ? "✓"
                : actionFeedback.type === "info"
                ? "ℹ️"
                : "⚠️"}{" "}
              {actionFeedback.text}
            </span>
          </div>
        )}

        {/* Tab Navigation */}
        <nav className="tab-navigation-bar">
          <button
            type="button"
            className={`tab-btn ${activeTab === "complaints" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("complaints")}
          >
            📋 Manage Complaints ({totalCount})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "departments" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("departments")}
          >
            🏢 Departments ({departments.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "notifications" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            🔔 System Notifications {unreadCount > 0 && <span className="tab-counter">{unreadCount}</span>}
          </button>
        </nav>

        {/* TAB 1: Manage Complaints */}
        {activeTab === "complaints" && (
          <section className="dashboard-main-panel">
            {/* Filter Toolbar */}
            <div className="admin-filters-section">
              <div className="search-row">
                <input
                  type="text"
                  placeholder="Search by title, location, description, or student name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="search-input"
                />

                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>

              <div className="filters-grid">
                <div className="filter-item">
                  <label>Status</label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>

                <div className="filter-item">
                  <label>Department</label>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                  >
                    <option value="All">All Departments</option>
                    <option value="Unassigned">Unassigned</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-item">
                  <label>Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="All">All Categories</option>
                    {COMPLAINT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-item">
                  <label>Priority</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="All">All Priorities</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div className="filter-stats-bar">
                <span>Showing {filteredComplaints.length} of {complaints.length} complaints</span>
              </div>
            </div>

            {/* Complaints List */}
            {filteredComplaints.length === 0 ? (
              <div className="empty-state-box">
                <span className="empty-icon">🔍</span>
                <h3>No complaints match your filters</h3>
                <p>Try resetting the search terms or status filters above.</p>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={resetFilters}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="complaints-grid">
                {filteredComplaints.map((item) => (
                  <article
                    key={item.id}
                    className={`complaint-card admin-complaint-item ${
                      item.status === "Pending" ? "card-highlight-new" : ""
                    }`}
                  >
                    <div className="card-top-header">
                      <div className="card-tag-row">
                        <span className="id-badge">#{item.id}</span>
                        <span className="category-pill">{item.category}</span>
                        <span className={`priority-pill priority-${item.priority.toLowerCase()}`}>
                          {item.priority} Priority
                        </span>
                        {item.status === "Pending" && (
                          <span className="new-pulse-badge">NEW</span>
                        )}
                      </div>

                      <span className={`status-badge status-${item.status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {item.status}
                      </span>
                    </div>

                    <h3 className="complaint-card-title">{item.title}</h3>

                    <div className="reporter-info-banner">
                      <span>👤 <strong>Student:</strong> {item.userName} ({item.userEmail || "No email"})</span>
                      <span>📍 <strong>Location:</strong> {item.location}</span>
                    </div>

                    <p className="complaint-card-desc">{item.description}</p>

                    {item.photoUrl && (
                      <div className="card-photo-box">
                        <img
                          src={item.photoUrl}
                          alt="Student submitted evidence"
                          className="complaint-thumb"
                          onClick={() => setLightboxPhoto(item.photoUrl)}
                        />
                        <button
                          type="button"
                          className="btn-link btn-xs"
                          onClick={() => setLightboxPhoto(item.photoUrl)}
                        >
                          🔍 Inspect Full Image
                        </button>
                      </div>
                    )}

                    <div className="card-footer-meta">
                      <span>Submitted: {formatDate(item.createdAt)}</span>
                      <span>Last Updated: {formatDate(item.updatedAt)}</span>
                      <span>👥 {item.voteCount} community {item.voteCount === 1 ? "support" : "supports"}</span>
                    </div>

                    {/* Admin Action Controls */}
                    <div className="admin-triage-controls">
                      <div className="control-cell">
                        <label htmlFor={`dept-${item.id}`}>Department</label>
                        <select
                          id={`dept-${item.id}`}
                          value={item.departmentId || ""}
                          onChange={(e) => handleChangeDepartment(item.id, e.target.value)}
                        >
                          <option value="">Not Assigned</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={String(dept.id)}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="control-cell">
                        <label htmlFor={`prio-${item.id}`}>Priority</label>
                        <select
                          id={`prio-${item.id}`}
                          value={item.priority || "Medium"}
                          onChange={(e) => handleChangePriority(item.id, e.target.value)}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>

                      <div className="control-cell">
                        <label htmlFor={`status-${item.id}`}>Status</label>
                        <select
                          id={`status-${item.id}`}
                          value={item.status}
                          onChange={(e) => handleChangeStatus(item.id, e.target.value)}
                        >
                          <option value="Pending">Pending</option>
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>
                    </div>

                    {/* Timeline & Discussion */}
                    <div className="card-accordions">
                      <ComplaintTimeline
                        issueId={item.id}
                        refreshKey={`${item.updatedAt}-${item.departmentName}-${item.status}-${item.priority}`}
                      />
                      <ComplaintComments issueId={item.id} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: Department Directory */}
        {activeTab === "departments" && (
          <section className="dashboard-main-panel">
            <div className="panel-title-area">
              <h2>Campus Departments</h2>
              <p>Manage and create maintenance and administrative departments for routing complaints.</p>
            </div>

            {departmentActionMsg.text && (
              <div className={`inline-banner banner-${departmentActionMsg.type}`}>
                <span>{departmentActionMsg.type === "success" ? "✓" : "⚠️"} {departmentActionMsg.text}</span>
              </div>
            )}

            {/* Add Department Form */}
            <form onSubmit={handleCreateDepartment} className="department-create-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="dept-name">Department Name *</label>
                  <input
                    id="dept-name"
                    type="text"
                    placeholder="e.g. Electrical & HVAC Maintenance"
                    value={newDepartmentName}
                    onChange={(e) => setNewDepartmentName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="dept-desc">Description (Optional)</label>
                  <input
                    id="dept-desc"
                    type="text"
                    placeholder="Responsibilities or head contact..."
                    value={newDepartmentDesc}
                    onChange={(e) => setNewDepartmentDesc(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={creatingDept || !newDepartmentName.trim()}
              >
                {creatingDept ? "Adding..." : "➕ Add Department"}
              </button>
            </form>

            {/* Department Grid */}
            <div className="departments-grid">
              {departments.map((dept) => {
                const assignedCount = complaints.filter(
                  (c) => String(c.departmentId) === String(dept.id)
                ).length;

                return (
                  <div key={dept.id} className="dept-card">
                    <div className="dept-icon-box">🏢</div>
                    <div className="dept-info">
                      <h4>{dept.name}</h4>
                      <p>{dept.description || "General maintenance and campus operations."}</p>
                      <span className="dept-counter-pill">
                        {assignedCount} active {assignedCount === 1 ? "complaint" : "complaints"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 3: Notifications */}
        {activeTab === "notifications" && (
          <section className="dashboard-main-panel">
            <div className="panel-title-area">
              <h2>Administrator Notifications</h2>
              <p>Notifications of new complaints filed and student comments.</p>
            </div>

            {notifications.length === 0 ? (
              <div className="empty-state-box">
                <span className="empty-icon">🔔</span>
                <h3>No notifications</h3>
                <p>Everything is up to date.</p>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map((note) => (
                  <div
                    key={note.id}
                    className={`notification-item ${!note.is_read ? "note-unread" : ""}`}
                  >
                    <div className="note-icon">
                      {note.type === "new_complaint"
                        ? "📥"
                        : note.type === "comment"
                        ? "💬"
                        : "ℹ️"}
                    </div>
                    <div className="note-body">
                      <div className="note-header">
                        <h4>{note.title || "Notification"}</h4>
                        <span className="note-time">{formatDate(note.created_at)}</span>
                      </div>
                      <p className="note-message">{note.message}</p>
                    </div>
                    {!note.is_read ? (
                      <button
                        type="button"
                        className="btn-outline btn-xs"
                        onClick={() => handleNotificationRead(note.id)}
                      >
                        Mark Read
                      </button>
                    ) : (
                      <span className="read-status">✓ Read</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div className="modal-backdrop" onClick={() => setLightboxPhoto(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxPhoto} alt="Full resolution proof" />
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setLightboxPhoto(null)}
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
