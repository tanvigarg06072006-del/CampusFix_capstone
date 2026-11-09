import { auth } from "../firebase";

const BASE_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_URL = `${BASE_API_URL}/api/issues`;

export const COMPLAINT_CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Furniture",
  "Cleanliness",
  "Internet",
  "Classroom Equipment",
  "Laboratory Equipment",
  "Hostel",
  "Security",
  "Other"
];

export const COMPLAINT_PRIORITIES = ["Low", "Medium", "High"];

async function getAuthHeaders() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("Please log in again.");
  }

  const token = await user.getIdToken();

  return {
    Authorization: `Bearer ${token}`
  };
}

function formatStatus(status) {
  if (!status) return "Pending";
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPriority(priority) {
  if (!priority) return "Medium";

  return String(priority)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function getComplaints() {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}?limit=100`, {
    headers,
    cache: "no-store"
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load complaints");
  }

  return (data.issues || []).map((issue) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    status: formatStatus(issue.status),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    userName: issue.reporter_name || "Student",
    userEmail: issue.reporter_email || "",
    departmentId: issue.department_id == null ? "" : String(issue.department_id),
    departmentName: issue.department_name || "",
    priority: formatPriority(issue.priority),
    category: issue.category || "Other",
    location: issue.location || "Main Campus",
    voteCount: Number(issue.vote_count || 0),
    photoUrl: issue.photoUrl || null,
  }));
}

export async function addComplaint(complaint) {
  const headers = await getAuthHeaders();
  const formData = new FormData();

  formData.append("title", complaint.title.trim());
  formData.append("description", complaint.description.trim());
  formData.append("category", complaint.category || "Other");
  formData.append("priority", (complaint.priority || "Medium").toUpperCase());
  formData.append("location", complaint.location?.trim() || "Main Campus");

  if (complaint.photo) {
    formData.append("photo", complaint.photo);
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers,
    body: formData
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not submit complaint");
  }

  return data.issue;
}

// Fetch complaints submitted by all students
export async function getCommunityIssues() {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/community`, {
    headers,
    cache: "no-store"
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load community issues");
  }

  return (data.issues || []).map((issue) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    category: issue.category || "Other",
    location: issue.location || "Main Campus",
    priority: formatPriority(issue.priority),
    status: formatStatus(issue.status),
    createdAt: issue.created_at,
    userName: issue.reporter_name || "Student",
    reportedBy: String(issue.reported_by),
    voteCount: Number(issue.vote_count || 0),
    hasVoted: Boolean(issue.has_voted),
    photoUrl: issue.photoUrl || null
  }));
}

// Support another student's complaint
export async function voteForIssue(id) {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_URL}/${id}/vote`, {
    method: "POST",
    headers
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not record your support");
  }

  return data;
}

export async function updateComplaint(id, updates) {
  const headers = await getAuthHeaders();

  const statusMap = {
    "Pending": "PENDING",
    "Assigned": "ASSIGNED",
    "In Progress": "IN_PROGRESS",
    "Resolved": "RESOLVED",
    "Confirmed": "CONFIRMED",
    "Rejected": "REJECTED"
  };

  const response = await fetch(`${API_URL}/${id}/status`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      status: statusMap[updates.status] || updates.status
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not update complaint");
  }

  return data.issue;
}

export async function updatePriority(id, priority) {
  const headers = await getAuthHeaders();
  const priorityMap = {
    Low: "LOW",
    Medium: "MEDIUM",
    High: "HIGH"
  };
  const response = await fetch(`${API_URL}/${id}/priority`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      priority: priorityMap[priority] || priority
    })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not update priority");
  }

  return data.issue;
}

export async function getComplaintHistory(issueId) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/${issueId}/history`, {
    headers,
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load complaint activity");
  }

  return data.events || [];
}

export function complaintMatchesFilters(item, filters) {
  const searchText = (filters.search || "").trim().toLowerCase();
  const matchesSearch = !searchText ||
    (item.title || "").toLowerCase().includes(searchText) ||
    (item.description || "").toLowerCase().includes(searchText) ||
    (item.location || "").toLowerCase().includes(searchText) ||
    (item.userName || "").toLowerCase().includes(searchText) ||
    String(item.id).toLowerCase().includes(searchText);

  const matchesStatus = !filters.status || filters.status === "All" ||
    (filters.status === "New" && item.status === "Pending") ||
    item.status.toLowerCase() === filters.status.toLowerCase();

  const matchesDepartment = !filters.department || filters.department === "All" ||
    (filters.department === "Unassigned"
      ? !item.departmentName
      : item.departmentName === filters.department);

  const matchesCategory = !filters.category || filters.category === "All" ||
    item.category === filters.category;

  const matchesPriority = !filters.priority || filters.priority === "All" ||
    item.priority.toLowerCase() === filters.priority.toLowerCase();

  return matchesSearch && matchesStatus && matchesDepartment &&
    matchesCategory && matchesPriority;
}

export async function updateProfile(name) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BASE_API_URL}/api/auth/me`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not update your profile");
  }

  return data.user;
}

export async function getCurrentUser() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BASE_API_URL}/api/auth/me`, {
    headers,
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load your account");
  }

  return data.user;
}

export async function getDepartments() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BASE_API_URL}/api/departments`, {
    headers,
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load departments");
  }

  return data.departments || [];
}

export async function addDepartment(name, description = "") {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BASE_API_URL}/api/departments`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name, description })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not add department");
  }

  return data.department;
}

export async function assignDepartment(id, departmentId) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/${id}/department`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      department_id: departmentId === "" || departmentId == null
        ? null
        : String(departmentId)
    })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not assign department");
  }

  return data.issue;
}

export async function getComments(issueId) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BASE_API_URL}/api/comments/issue/${issueId}`, {
    headers,
    cache: "no-store"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load comments");
  }

  return data.comments || [];
}

export async function addComment(issueId, comment) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BASE_API_URL}/api/comments/issue/${issueId}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ comment })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not add comment");
  }

  return data.comment;
}

const NOTIFICATIONS_API_URL = `${BASE_API_URL}/api/notifications`;

// Fetch notifications for the logged-in user
export async function getNotifications() {
  const headers = await getAuthHeaders();

  const response = await fetch(NOTIFICATIONS_API_URL, {
    headers,
    cache: "no-store"
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load notifications");
  }

  return data.notifications || [];
}

// Mark a notification as read
export async function markNotificationRead(id) {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${NOTIFICATIONS_API_URL}/${id}/read`,
    {
      method: "PATCH",
      headers
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not mark notification as read");
  }

  return data;
}
