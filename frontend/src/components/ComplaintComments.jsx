import { useEffect, useState } from "react";
import { addComment, getComments } from "../utils/complaints";

export default function ComplaintComments({ issueId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    getComments(issueId)
      .then((rows) => {
        if (mounted) {
          setComments(rows);
          setError("");
        }
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [issueId]);

  async function submit(event) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      setSubmitting(true);
      setError("");
      const created = await addComment(issueId, trimmed);
      const rows = await getComments(issueId);
      setComments(
        rows.some((row) => String(row.id) === String(created.id))
          ? rows
          : [...rows, created]
      );
      setText("");
    } catch (submitError) {
      setError(submitError.message || "Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  }

  function formatTime(timestamp) {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  }

  function getInitials(name) {
    if (!name) return "U";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div className="comments-widget">
      <div className="comments-widget-header">
        <span className="comments-title">
          Discussion ({comments.length})
        </span>
      </div>

      {error && <div className="inline-banner banner-error">{error}</div>}

      <div className="comments-list">
        {loading && comments.length === 0 ? (
          <p className="subtle-text">Loading discussion...</p>
        ) : comments.length === 0 ? (
          <p className="subtle-text">No comments yet. Start the conversation below.</p>
        ) : (
          comments.map((comment) => {
            const author = comment.user_name || "User";
            const isStaff = comment.user_role === "admin" || (author.toLowerCase().includes("admin"));

            return (
              <div
                key={comment.id}
                className={`comment-bubble-item ${isStaff ? "comment-from-admin" : ""}`}
              >
                <div className={`avatar-pill ${isStaff ? "avatar-admin" : "avatar-student"}`}>
                  {getInitials(author)}
                </div>
                <div className="comment-body">
                  <div className="comment-meta">
                    <span className="comment-author">{author}</span>
                    {isStaff && <span className="admin-chip">Admin</span>}
                    <span className="comment-timestamp">
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="comment-text">{comment.comment}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={submit} className="comment-form">
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write a message or update..."
          disabled={submitting}
          maxLength={500}
        />
        <button
          type="submit"
          className="btn-primary btn-sm"
          disabled={submitting || !text.trim()}
        >
          {submitting ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
