import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

import {
  getComplaints,
  addComplaint,
  getCommunityIssues,
  voteForIssue,
  getNotifications,
  markNotificationRead,
  updateProfile,
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES
} from "../utils/complaints";
import { findSimilarComplaints } from "../utils/similarity";
import ComplaintComments from "../components/ComplaintComments";
import ComplaintTimeline from "../components/ComplaintTimeline";

export default function UserDashboard() {
  const navigate = useNavigate();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState("my-complaints");

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(COMPLAINT_CATEGORIES[0]);
  const [priority, setPriority] = useState("Medium");
  const [location, setLocation] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInputRef = useRef(null);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  // Data states
  const [complaints, setComplaints] = useState([]);
  const [communityIssues, setCommunityIssues] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Filter states
  const [myFilterStatus, setMyFilterStatus] = useState("All");
  const [mySearch, setMySearch] = useState("");
  const [communitySearch, setCommunitySearch] = useState("");

  // Feedback states
  const [formMessage, setFormMessage] = useState({ type: "", text: "" });
  const [communityMessage, setCommunityMessage] = useState({ type: "", text: "" });
  const [votingId, setVotingId] = useState(null);

  // Smart similar complaints state
  const [similarComplaints, setSimilarComplaints] = useState([]);
  const [selectedSimilarComplaint, setSelectedSimilarComplaint] = useState(null);

  // Profile modal state
  const [userName, setUserName] = useState(
    sessionStorage.getItem("campusfixUserName") || "Student"
  );
  const userEmail = sessionStorage.getItem("campusfixUserEmail") || "";
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState(userName);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState({ type: "", text: "" });

  // Lightbox / modal photo preview
  const [lightboxPhoto, setLightboxPhoto] = useState(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Load complaints and notifications periodically
  useEffect(() => {
    let isMounted = true;

    const refreshData = async () => {
      try {
        const [myData, notes, commData] = await Promise.all([
          getComplaints(),
          getNotifications(),
          getCommunityIssues()
        ]);

        if (!isMounted) return;
        setComplaints(myData);
        setNotifications(notes);
        setCommunityIssues(commData);
      } catch (error) {
        console.error("Dashboard refresh error:", error);
      }
    };

    refreshData();
    const intervalId = setInterval(refreshData, 6000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  // Smart live similar complaint detection
  useEffect(() => {
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 3) {
      setSimilarComplaints([]);
      return;
    }

    const timer = setTimeout(() => {
      const pool = [
        ...communityIssues,
        ...complaints.filter(
          (c) => !communityIssues.some((ci) => String(ci.id) === String(c.id))
        )
      ];

      const matches = findSimilarComplaints(
        {
          title: trimmedTitle,
          category,
          location: location.trim(),
          description: description.trim()
        },
        pool,
        35
      );

      setSimilarComplaints(matches);
    }, 150);

    return () => clearTimeout(timer);
  }, [title, category, location, description, communityIssues, complaints]);

  // Handle Photo selection
  function handlePhotoChange(e) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setPhoto(null);
      setPhotoPreview(null);
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(selectedFile.type)) {
      setFormMessage({
        type: "error",
        text: "Please select a JPG, PNG or WEBP image."
      });
      e.target.value = "";
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setFormMessage({
        type: "error",
        text: "Image file size exceeds the 5 MB limit."
      });
      e.target.value = "";
      return;
    }

    setPhoto(selectedFile);
    setPhotoPreview(URL.createObjectURL(selectedFile));
    setFormMessage({ type: "", text: "" });
  }

  // Submit Complaint
  async function submitComplaint(e) {
    e.preventDefault();
    setFormMessage({ type: "", text: "" });

    if (!title.trim()) {
      setFormMessage({ type: "error", text: "Please enter a descriptive title." });
      return;
    }

    if (!location.trim()) {
      setFormMessage({ type: "error", text: "Please provide the campus location." });
      return;
    }

    if (!description.trim()) {
      setFormMessage({ type: "error", text: "Please enter the complaint details." });
      return;
    }

    try {
      setSubmittingComplaint(true);

      await addComplaint({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        location: location.trim(),
        photo
      });

      const [myData, communityData] = await Promise.all([
        getComplaints(),
        getCommunityIssues()
      ]);

      setComplaints(myData);
      setCommunityIssues(communityData);

      // Reset form
      setTitle("");
      setDescription("");
      setLocation("");
      setCategory(COMPLAINT_CATEGORIES[0]);
      setPriority("Medium");
      setPhoto(null);
      setPhotoPreview(null);
      setSimilarComplaints([]);
      setSelectedSimilarComplaint(null);
      if (photoInputRef.current) photoInputRef.current.value = "";

      setFormMessage({
        type: "success",
        text: "Your complaint has been successfully submitted! Administration has been notified."
      });

      // Switch to my complaints tab
      setTimeout(() => {
        setActiveTab("my-complaints");
      }, 1500);
    } catch (error) {
      console.error(error);
      setFormMessage({
        type: "error",
        text: error.message || "Failed to submit complaint. Please try again."
      });
    } finally {
      setSubmittingComplaint(false);
    }
  }

  // Vote for community issue
  async function handleVote(issueId) {
    try {
      setVotingId(issueId);
      setCommunityMessage({ type: "", text: "" });

      const result = await voteForIssue(issueId);

      setCommunityIssues((previous) =>
        previous.map((issue) =>
          String(issue.id) === String(issueId)
            ? {
                ...issue,
                voteCount: Number(result.vote_count),
                hasVoted: true
              }
            : issue
        )
      );

      setSelectedSimilarComplaint((previous) =>
        previous && String(previous.id) === String(issueId)
          ? {
              ...previous,
              voteCount: Number(result.vote_count),
              hasVoted: true
            }
          : previous
      );

      setCommunityMessage({
        type: "success",
        text: "Your support has been recorded! This increases issue priority."
      });
    } catch (error) {
      console.error(error);
      setCommunityMessage({
        type: "error",
        text: error.message || "Could not record support."
      });
    } finally {
      setVotingId(null);
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

  // Save profile name
  async function handleSaveProfile(e) {
    e.preventDefault();
    const cleanName = editName.trim();
    if (cleanName.length < 2 || cleanName.length > 80) {
      setProfileMessage({
        type: "error",
        text: "Name must be between 2 and 80 characters."
      });
      return;
    }

    try {
      setProfileSaving(true);
      setProfileMessage({ type: "", text: "" });
      const updated = await updateProfile(cleanName);
      setUserName(updated.name);
      sessionStorage.setItem("campusfixUserName", updated.name);
      setProfileMessage({
        type: "success",
        text: "Profile updated successfully!"
      });
      setTimeout(() => {
        setShowProfileModal(false);
        setProfileMessage({ type: "", text: "" });
      }, 1000);
    } catch (err) {
      setProfileMessage({
        type: "error",
        text: err.message || "Could not update profile."
      });
    } finally {
      setProfileSaving(false);
    }
  }

  async function logout() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
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

  // Computed metrics
  const myComplaintIds = new Set(complaints.map((item) => String(item.id)));
  const totalMyComplaints = complaints.length;
  const pendingCount = complaints.filter((c) => c.status === "Pending").length;
  const inProgressCount = complaints.filter((c) => c.status === "In Progress").length;
  const resolvedCount = complaints.filter((c) => c.status === "Resolved").length;

  const filteredMyComplaints = complaints.filter((item) => {
    const matchesSearch =
      !mySearch.trim() ||
      item.title.toLowerCase().includes(mySearch.toLowerCase()) ||
      item.description.toLowerCase().includes(mySearch.toLowerCase()) ||
      item.location.toLowerCase().includes(mySearch.toLowerCase());

    const matchesStatus =
      myFilterStatus === "All" || item.status === myFilterStatus;

    return matchesSearch && matchesStatus;
  });

  const filteredCommunityIssues = communityIssues.filter((item) => {
    if (!communitySearch.trim()) return true;
    const q = communitySearch.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.location && item.location.toLowerCase().includes(q))
    );
  });

  return (
    <div className="dashboard-layout">
      {/* Top Navigation Bar */}
      <header className="app-nav-header">
        <div className="nav-brand-section">
          <div className="brand-badge-box">🏢</div>
          <div>
            <span className="brand-name">CampusFix</span>
            <span className="badge-role-pill student-pill">Student Portal</span>
          </div>
        </div>

        <div className="nav-user-actions">
          <div
            className="user-profile-widget"
            onClick={() => {
              setEditName(userName);
              setShowProfileModal(true);
            }}
            title="Click to edit profile"
          >
            <div className="avatar-pill avatar-student">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="user-details-text">
              <span className="user-display-name">{userName} ✎</span>
              <span className="user-display-email">{userEmail}</span>
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
            <span className="metric-label">Total Filed</span>
            <strong className="metric-value">{totalMyComplaints}</strong>
          </div>
          <div className="metric-box metric-pending">
            <span className="metric-label">Pending</span>
            <strong className="metric-value">{pendingCount}</strong>
          </div>
          <div className="metric-box metric-progress">
            <span className="metric-label">In Progress</span>
            <strong className="metric-value">{inProgressCount}</strong>
          </div>
          <div className="metric-box metric-resolved">
            <span className="metric-label">Resolved</span>
            <strong className="metric-value">{resolvedCount}</strong>
          </div>
        </section>

        {/* Tab Navigation */}
        <nav className="tab-navigation-bar">
          <button
            type="button"
            className={`tab-btn ${activeTab === "my-complaints" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("my-complaints")}
          >
            📋 My Complaints ({totalMyComplaints})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "submit" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("submit")}
          >
            ➕ File Complaint
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "community" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("community")}
          >
            🤝 Community Feed ({communityIssues.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "notifications" ? "tab-active" : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            🔔 Notifications {unreadCount > 0 && <span className="tab-counter">{unreadCount}</span>}
          </button>
        </nav>

        {/* TAB 1: My Complaints */}
        {activeTab === "my-complaints" && (
          <section className="dashboard-main-panel">
            <div className="panel-toolbar">
              <div className="panel-title-area">
                <h2>My Reported Complaints</h2>
                <p>Track the status, view updates, and discuss with administrators.</p>
              </div>

              <div className="panel-controls-row">
                <input
                  type="text"
                  placeholder="Search my complaints..."
                  value={mySearch}
                  onChange={(e) => setMySearch(e.target.value)}
                  className="search-input"
                />

                <select
                  value={myFilterStatus}
                  onChange={(e) => setMyFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                </select>
              </div>
            </div>

            {filteredMyComplaints.length === 0 ? (
              <div className="empty-state-box">
                <span className="empty-icon">📭</span>
                <h3>No complaints match your criteria</h3>
                <p>Submit a new maintenance request or clear search filters.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setActiveTab("submit")}
                >
                  ➕ File a Complaint Now
                </button>
              </div>
            ) : (
              <div className="complaints-grid">
                {filteredMyComplaints.map((item) => (
                  <article key={item.id} className="complaint-card">
                    <div className="card-top-header">
                      <div className="card-tag-row">
                        <span className="category-pill">{item.category}</span>
                        <span className={`priority-pill priority-${item.priority.toLowerCase()}`}>
                          {item.priority} Priority
                        </span>
                      </div>
                      <span className={`status-badge status-${item.status.toLowerCase().replace(/\s+/g, "-")}`}>
                        {item.status}
                      </span>
                    </div>

                    <h3 className="complaint-card-title">{item.title}</h3>

                    <div className="card-meta-line">
                      <span>📍 <strong>Location:</strong> {item.location}</span>
                      <span>🏢 <strong>Department:</strong> {item.departmentName || "Pending Assignment"}</span>
                    </div>

                    <p className="complaint-card-desc">{item.description}</p>

                    {/* Complaint Photo Preview */}
                    {item.photoUrl && (
                      <div className="card-photo-box">
                        <img
                          src={item.photoUrl}
                          alt="Complaint proof"
                          className="complaint-thumb"
                          onClick={() => setLightboxPhoto(item.photoUrl)}
                        />
                        <button
                          type="button"
                          className="btn-link btn-xs"
                          onClick={() => setLightboxPhoto(item.photoUrl)}
                        >
                          🔍 View Full Photo
                        </button>
                      </div>
                    )}

                    <div className="card-footer-meta">
                      <span>Submitted: {formatDate(item.createdAt)}</span>
                      <span>Updated: {formatDate(item.updatedAt)}</span>
                      <span>👍 {item.voteCount} community {item.voteCount === 1 ? "support" : "supports"}</span>
                    </div>

                    {/* Embedded Timeline and Comments */}
                    <div className="card-accordions">
                      <ComplaintTimeline
                        issueId={item.id}
                        refreshKey={`${item.updatedAt}-${item.status}-${item.priority}`}
                      />
                      <ComplaintComments issueId={item.id} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: Submit New Complaint */}
        {activeTab === "submit" && (
          <section className="dashboard-main-panel">
            <div className="panel-title-area">
              <h2>Submit a Campus Complaint</h2>
              <p>Provide detailed information so our facilities team can address the issue promptly.</p>
            </div>

            {formMessage.text && (
              <div className={`inline-banner banner-${formMessage.type}`}>
                <span>{formMessage.type === "success" ? "✓" : "⚠️"} {formMessage.text}</span>
              </div>
            )}

            <form onSubmit={submitComplaint} className="complaint-entry-form">
              <div className="form-group">
                <label htmlFor="complaint-title">Complaint Title *</label>
                <input
                  id="complaint-title"
                  type="text"
                  placeholder="Brief summary (e.g. Water leakage in 2nd floor restroom)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="complaint-category">Issue Category *</label>
                  <select
                    id="complaint-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    {COMPLAINT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="complaint-priority">Severity / Priority</label>
                  <select
                    id="complaint-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {COMPLAINT_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p} Priority
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="complaint-location">Location / Building & Room *</label>
                <input
                  id="complaint-location"
                  type="text"
                  placeholder="e.g. Science Complex Block A, Room 304"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  maxLength={120}
                  required
                />
              </div>

              {/* SMART SIMILAR COMPLAINT DETECTION PANEL */}
              {similarComplaints.length > 0 && (
                <div className="similar-detection-panel">
                  <div className="similar-panel-header">
                    <span className="similar-badge-pill">🔍 Smart Detection</span>
                    <div className="similar-header-text">
                      <h3>Similar Existing Complaints Found ({similarComplaints.length})</h3>
                      <p>
                        We detected similar complaints already reported on campus. If one of these matches your problem, you can support it with <strong>Me-Too</strong> to increase its priority, or proceed to submit your new complaint below.
                      </p>
                    </div>
                  </div>

                  <div className="similar-complaints-list">
                    {similarComplaints.map((item) => {
                      const isMine = myComplaintIds.has(String(item.id));
                      const scoreBadgeClass =
                        item.similarityScore >= 70
                          ? "sim-score-high"
                          : item.similarityScore >= 50
                          ? "sim-score-med"
                          : "sim-score-low";

                      return (
                        <div key={item.id} className="similar-complaint-item">
                          <div className="similar-item-top">
                            <div className="similar-meta-badges">
                              <span className={`similarity-score-pill ${scoreBadgeClass}`}>
                                🎯 {item.similarityScore}% Match
                              </span>
                              <span className="category-pill">{item.category}</span>
                              <span
                                className={`status-badge status-${item.status
                                  .toLowerCase()
                                  .replace(/\s+/g, "-")}`}
                              >
                                {item.status}
                              </span>
                            </div>
                          </div>

                          <h4 className="similar-item-title">{item.title}</h4>

                          <div className="similar-item-meta">
                            <span>📍 <strong>Location:</strong> {item.location}</span>
                            <span>👥 <strong>Support:</strong> {item.voteCount || 0} students facing this</span>
                          </div>

                          <div className="similar-item-actions">
                            <button
                              type="button"
                              className="btn-outline btn-xs"
                              onClick={() => setSelectedSimilarComplaint(item)}
                            >
                              🔍 Open & Review Details
                            </button>

                            <button
                              type="button"
                              className={`btn-support btn-xs ${
                                item.hasVoted
                                  ? "btn-supported"
                                  : isMine
                                  ? "btn-disabled"
                                  : "btn-primary"
                              }`}
                              disabled={isMine || item.hasVoted || votingId === item.id}
                              onClick={() => handleVote(item.id)}
                            >
                              {isMine
                                ? "Your Complaint"
                                : item.hasVoted
                                ? "✓ Supported"
                                : votingId === item.id
                                ? "Recording..."
                                : "👍 I'm Facing This Too"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="similar-reassurance-note">
                    <span>💡 <em>Facing a different issue or distinct problem? You can still submit your complaint below.</em></span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="complaint-desc">Detailed Description *</label>
                <textarea
                  id="complaint-desc"
                  placeholder="Describe the problem, when it occurred, and any safety hazards..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="complaint-photo-file">Proof / Photo Attachment (Optional, max 5 MB)</label>
                <input
                  ref={photoInputRef}
                  id="complaint-photo-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="file-picker-input"
                />

                {photoPreview && (
                  <div className="attached-photo-preview">
                    <img src={photoPreview} alt="Selected proof preview" />
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => {
                        setPhoto(null);
                        setPhotoPreview(null);
                        if (photoInputRef.current) photoInputRef.current.value = "";
                      }}
                    >
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              <div className="form-actions-row">
                <button
                  type="submit"
                  className="btn-primary btn-lg"
                  disabled={submittingComplaint}
                >
                  {submittingComplaint ? "Submitting Complaint..." : "Submit Complaint"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* TAB 3: Community Feed */}
        {activeTab === "community" && (
          <section className="dashboard-main-panel">
            <div className="panel-toolbar">
              <div className="panel-title-area">
                <h2>Community Problem Feed</h2>
                <p>
                  Browse open complaints submitted by fellow students. Support issues you also encounter to elevate their priority.
                </p>
              </div>

              <input
                type="text"
                placeholder="Search community issues..."
                value={communitySearch}
                onChange={(e) => setCommunitySearch(e.target.value)}
                className="search-input"
              />
            </div>

            {communityMessage.text && (
              <div className={`inline-banner banner-${communityMessage.type}`}>
                <span>{communityMessage.type === "success" ? "✓" : "⚠️"} {communityMessage.text}</span>
              </div>
            )}

            {filteredCommunityIssues.length === 0 ? (
              <div className="empty-state-box">
                <span className="empty-icon">🤝</span>
                <h3>No open community complaints found</h3>
                <p>All open issues submitted across campus will appear here.</p>
              </div>
            ) : (
              <div className="complaints-grid">
                {filteredCommunityIssues.map((item) => {
                  const isMine = myComplaintIds.has(String(item.id));

                  return (
                    <article key={item.id} className="complaint-card community-card">
                      <div className="card-top-header">
                        <div className="card-tag-row">
                          <span className="category-pill">{item.category}</span>
                          <span className={`priority-pill priority-${item.priority.toLowerCase()}`}>
                            {item.priority}
                          </span>
                        </div>
                        <span className={`status-badge status-${item.status.toLowerCase().replace(/\s+/g, "-")}`}>
                          {item.status}
                        </span>
                      </div>

                      <h3 className="complaint-card-title">{item.title}</h3>

                      <div className="card-meta-line">
                        <span>📍 <strong>Location:</strong> {item.location}</span>
                        <span>👤 <strong>Reported by:</strong> {item.userName}</span>
                      </div>

                      <p className="complaint-card-desc">{item.description}</p>

                      {item.photoUrl && (
                        <div className="card-photo-box">
                          <img
                            src={item.photoUrl}
                            alt="Issue proof"
                            className="complaint-thumb"
                            onClick={() => setLightboxPhoto(item.photoUrl)}
                          />
                        </div>
                      )}

                      <div className="card-footer-meta">
                        <span>Reported: {formatDate(item.createdAt)}</span>
                        <span>👥 <strong>{item.voteCount}</strong> students facing this too</span>
                      </div>

                      <div className="community-action-row">
                        <button
                          type="button"
                          className={`btn-support ${
                            item.hasVoted
                              ? "btn-supported"
                              : isMine
                              ? "btn-disabled"
                              : "btn-primary"
                          }`}
                          disabled={isMine || item.hasVoted || votingId === item.id}
                          onClick={() => handleVote(item.id)}
                        >
                          {isMine
                            ? "Your Complaint"
                            : item.hasVoted
                            ? "✓ Supported"
                            : votingId === item.id
                            ? "Recording..."
                            : "👍 I'm Facing This Too"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 4: Notifications */}
        {activeTab === "notifications" && (
          <section className="dashboard-main-panel">
            <div className="panel-title-area">
              <h2>Notifications & Updates</h2>
              <p>Stay informed about status updates, department assignments, and comments.</p>
            </div>

            {notifications.length === 0 ? (
              <div className="empty-state-box">
                <span className="empty-icon">🔔</span>
                <h3>No notifications</h3>
                <p>You are all caught up!</p>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map((note) => (
                  <div
                    key={note.id}
                    className={`notification-item ${!note.is_read ? "note-unread" : ""}`}
                  >
                    <div className="note-icon">
                      {note.type === "status"
                        ? "🔄"
                        : note.type === "department"
                        ? "🏢"
                        : note.type === "comment"
                        ? "💬"
                        : "ℹ️"}
                    </div>
                    <div className="note-body">
                      <div className="note-header">
                        <h4>{note.title || "Update"}</h4>
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

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="modal-backdrop" onClick={() => setShowProfileModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Profile</h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowProfileModal(false)}
              >
                ✕
              </button>
            </div>

            {profileMessage.text && (
              <div className={`inline-banner banner-${profileMessage.type}`}>
                <span>{profileMessage.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="modal-form">
              <div className="form-group">
                <label htmlFor="edit-user-name">Full Name</label>
                <input
                  id="edit-user-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input type="text" value={userEmail} disabled className="input-disabled" />
                <span className="helper-text">Email address is managed by your institution.</span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowProfileModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={profileSaving}
                >
                  {profileSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Photo Preview Modal */}
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

      {/* Similar Complaint Detail Review Modal */}
      {selectedSimilarComplaint && (
        <div className="modal-backdrop" onClick={() => setSelectedSimilarComplaint(null)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-info">
                <span className="id-badge">#{selectedSimilarComplaint.id}</span>
                <span
                  className={`similarity-score-pill ${
                    selectedSimilarComplaint.similarityScore >= 70
                      ? "sim-score-high"
                      : selectedSimilarComplaint.similarityScore >= 50
                      ? "sim-score-med"
                      : "sim-score-low"
                  }`}
                >
                  🎯 {selectedSimilarComplaint.similarityScore}% Match
                </span>
                <span
                  className={`status-badge status-${selectedSimilarComplaint.status
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
                >
                  {selectedSimilarComplaint.status}
                </span>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setSelectedSimilarComplaint(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-complaint-body">
              <h3 className="modal-complaint-title">{selectedSimilarComplaint.title}</h3>

              <div className="card-meta-line">
                <span>📍 <strong>Location:</strong> {selectedSimilarComplaint.location}</span>
                <span>🏷️ <strong>Category:</strong> {selectedSimilarComplaint.category}</span>
                <span>👤 <strong>Reported by:</strong> {selectedSimilarComplaint.userName || "Student"}</span>
                <span>👥 <strong>Support:</strong> {selectedSimilarComplaint.voteCount || 0} students</span>
              </div>

              <p className="modal-complaint-desc">
                {selectedSimilarComplaint.description || "No description provided."}
              </p>

              {selectedSimilarComplaint.photoUrl && (
                <div className="card-photo-box">
                  <img
                    src={selectedSimilarComplaint.photoUrl}
                    alt="Complaint proof"
                    className="complaint-thumb"
                    onClick={() => setLightboxPhoto(selectedSimilarComplaint.photoUrl)}
                  />
                  <button
                    type="button"
                    className="btn-link btn-xs"
                    onClick={() => setLightboxPhoto(selectedSimilarComplaint.photoUrl)}
                  >
                    🔍 View Full Photo
                  </button>
                </div>
              )}

              <div className="modal-actions-bar">
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setSelectedSimilarComplaint(null)}
                >
                  Close
                </button>

                <button
                  type="button"
                  className={`btn-support ${
                    selectedSimilarComplaint.hasVoted
                      ? "btn-supported"
                      : myComplaintIds.has(String(selectedSimilarComplaint.id))
                      ? "btn-disabled"
                      : "btn-primary"
                  }`}
                  disabled={
                    myComplaintIds.has(String(selectedSimilarComplaint.id)) ||
                    selectedSimilarComplaint.hasVoted ||
                    votingId === selectedSimilarComplaint.id
                  }
                  onClick={() => handleVote(selectedSimilarComplaint.id)}
                >
                  {myComplaintIds.has(String(selectedSimilarComplaint.id))
                    ? "Your Complaint"
                    : selectedSimilarComplaint.hasVoted
                    ? "✓ Supported"
                    : votingId === selectedSimilarComplaint.id
                    ? "Recording..."
                    : "👍 I'm Facing This Too"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
