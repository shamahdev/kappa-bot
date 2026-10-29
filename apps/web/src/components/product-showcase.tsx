import { useId, useState } from "react";

import { DEMO_JOBS, resolveDemoReply } from "./showcase-data";
import { Tabs } from "./ui";

export const DiscordPreview = () => {
  const [reply, setReply] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState("");
  const id = useId();
  const job = DEMO_JOBS.find((item) => item.id === selected);
  const choose = (number: number) => {
    setReply(String(number));
    setSelected(number);
    setError("");
  };
  return (
    <div
      aria-label="Interactive Discord delivery demo"
      className="discord-preview"
    >
      <div className="discord-channel">
        <span aria-hidden="true">#</span> job-alerts{" "}
        <span className="discord-demo-label">Demo</span>
      </div>
      <div className="discord-message">
        <span aria-hidden="true" className="discord-avatar">
          κ
        </span>
        <div className="discord-content">
          <div className="discord-author">
            Kappa <span>App</span>
          </div>
          <ol className="discord-jobs">
            {DEMO_JOBS.map((item) => (
              <li key={item.id}>
                <button
                  aria-label={`Reply ${item.id}: ${item.title}`}
                  aria-pressed={selected === item.id}
                  onClick={() => choose(item.id)}
                  type="button"
                >
                  <strong>{item.title}</strong>
                  <span>{item.location}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="discord-hint">Reply with a number to open a posting.</p>
        </div>
      </div>
      <form
        className="discord-reply"
        onSubmit={(event) => {
          event.preventDefault();
          const result = resolveDemoReply(reply);
          if (result) {
            setSelected(result.id);
            setError("");
          } else {
            setError("Choose a job number: 1, 2 or 3.");
          }
        }}
      >
        <label htmlFor={id}>Try a reply</label>
        <div className="discord-reply-row">
          <input
            aria-describedby={`${id}-help`}
            aria-invalid={Boolean(error) || undefined}
            autoComplete="off"
            id={id}
            inputMode="numeric"
            name="demo-reply"
            onChange={(event) => {
              setReply(event.target.value);
              setError("");
            }}
            placeholder="1, 2 or 3"
            value={reply}
          />
          <button type="submit">Reply</button>
        </div>
        <output className="discord-feedback" id={`${id}-help`}>
          {error || "Demo only. Nothing sent."}
        </output>
      </form>
      <div aria-live="polite" className="discord-result">
        {job ? (
          <>
            <div className="discord-result-title">
              <strong>{job.title}</strong>
              <button
                onClick={() => {
                  setSelected(null);
                  setReply("");
                }}
                type="button"
              >
                Reset
              </button>
            </div>
            <p>
              {job.company}, {job.location}
            </p>
            <p>{job.summary}</p>
            <span className="discord-result-source">
              Source: {job.source}. Example posting.
            </span>
          </>
        ) : (
          <p>Reply 1, 2 or 3.</p>
        )}
      </div>
    </div>
  );
};

export const DashboardPreview = () => {
  const [view, setView] = useState("jobs");
  const [query, setQuery] = useState("");
  const id = useId();
  const jobs = DEMO_JOBS.filter((job) =>
    `${job.title} ${job.company}`.toLowerCase().includes(query.toLowerCase())
  );
  return (
    <div
      aria-label="Interactive dashboard preview"
      className="dashboard-preview"
    >
      <div className="dashboard-preview-nav">
        <span className="app-wordmark">
          <span aria-hidden="true" className="app-logo">
            κ
          </span>
          kappa
        </span>
        <span className="app-muted">Demo dashboard</span>
      </div>
      <div className="dashboard-preview-content">
        <h3>Direct messages</h3>
        <Tabs
          onChange={setView}
          tabs={[
            {
              value: "jobs",
              label: "Jobs",
              content: (
                <>
                  <div className="app-field preview-search">
                    <label htmlFor={id}>Search jobs</label>
                    <input
                      autoComplete="off"
                      id={id}
                      name="preview-search"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Title or company"
                      value={query}
                    />
                  </div>
                  <ul className="dashboard-preview-jobs">
                    {jobs.map((job) => (
                      <li key={job.id}>
                        <div>
                          <strong>{job.title}</strong>
                          <p>{job.location}</p>
                        </div>
                        <span className="app-badge">{job.source}</span>
                      </li>
                    ))}
                  </ul>
                  {jobs.length === 0 ? (
                    <p className="preview-empty">
                      No demo jobs match. Try another search.
                    </p>
                  ) : null}
                </>
              ),
            },
            {
              value: "manage",
              label: "Subscriptions",
              content: (
                <div className="preview-subscriptions">
                  <div>
                    <span>
                      <strong>Engineering roles</strong>
                      <small>Kalibrr, Jakarta</small>
                    </span>
                    <span className="app-status active">Active</span>
                  </div>
                  <div>
                    <span>
                      <strong>Design roles</strong>
                      <small>Glints, Remote</small>
                    </span>
                    <span className="app-status active">Active</span>
                  </div>
                  <p className="app-muted">
                    Example subscriptions. Sign in to create your own.
                  </p>
                </div>
              ),
            },
          ]}
          value={view}
        />
      </div>
    </div>
  );
};

export const ProductShowcase = () => (
  <div className="showcase-panels grid lg:grid-cols-2">
    <figure>
      <div className="showcase-panel-title">
        <h3>Discord</h3>
        <span>Try a number</span>
      </div>
      <DiscordPreview />
      <figcaption>Example postings.</figcaption>
    </figure>
    <figure>
      <div className="showcase-panel-title">
        <h3>Dashboard</h3>
        <span>Try the tabs</span>
      </div>
      <DashboardPreview />
      <figcaption>Example dashboard.</figcaption>
    </figure>
  </div>
);
