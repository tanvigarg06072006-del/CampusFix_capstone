import { useEffect, useState } from "react";
import { getComplaintHistory } from "../utils/complaints";

export default function ComplaintTimeline({ issueId, refreshKey }) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    getComplaintHistory(issueId)
      .then((rows) => {
        if (mounted) {
          setEvents(rows);
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
  }, [issueId, refreshKey]);

  function formatTime(timestamp) {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  }

  return (
    <div className="timeline-widget">
      <span className="timeline-title">Activity Trail</span>

      {error && <div className="inline-banner banner-error">{error}</div>}

      {loading && events.length === 0 ? (
        <p className="subtle-text">Loading activity trail...</p>
      ) : events.length === 0 ? (
        <p className="subtle-text">No activity logged yet.</p>
      ) : (
        <div className="timeline-trail">
          {events.map((event, index) => {
            const isLast = index === events.length - 1;
            const isFirst = index === 0;

            return (
              <div key={event.id} className="timeline-item">
                <div className="timeline-rail">
                  <div className={`timeline-dot ${isLast ? "dot-active" : isFirst ? "dot-start" : ""}`} />
                  {!isLast && <div className="timeline-line" />}
                </div>
                <div className="timeline-content">
                  <p className="timeline-desc">{event.description}</p>
                  <span className="timeline-date">{formatTime(event.occurred_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
