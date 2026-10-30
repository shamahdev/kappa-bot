import { useId, useState } from "react";

import { KappaMark } from "./kappa-mark";
import {
  DEMO_JOBS,
  DISCORD_DEMO_JOBS,
  DISCORD_DEMO_SUMMARY,
} from "./showcase-data";
import { Tabs } from "./ui";

const DiscordAuthor = ({ time }: { time: string }) => (
  <div className="discord-author">
    <strong>Kappa</strong>
    <span className="discord-app-label">APP</span>
    <time>{time}</time>
  </div>
);

export const DiscordPreview = () => {
  const job = DISCORD_DEMO_SUMMARY;
  return (
    <div
      aria-label="Discord job alert and summary conversation"
      className="discord-preview"
    >
      <div className="discord-message">
        <KappaMark className="discord-avatar" />
        <div className="discord-content">
          <DiscordAuthor time="3:30 PM" />
          <div className="discord-embed">
            <h3>4 new &apos;database&apos; jobs found in Kalibrr</h3>
            <ol className="discord-jobs">
              {DISCORD_DEMO_JOBS.map((item) => (
                <li key={item.id}>
                  <span className="discord-job-title">
                    {item.title} @ {item.company}
                  </span>
                </li>
              ))}
            </ol>
            <p className="discord-hint">
              Reply with 1–4 to get the summary of the job
            </p>
          </div>
        </div>
      </div>
      <div className="discord-user-message">
        <div className="discord-user-reply">
          <span className="discord-reply-reference">Replying to @Kappa</span>
          <div className="discord-author discord-user-author">
            <strong>You</strong>
            <time>3:36 PM</time>
          </div>
          <p>{job.reply}</p>
        </div>
      </div>
      <div className="discord-message discord-summary-message">
        <KappaMark className="discord-avatar" />
        <div className="discord-content">
          <DiscordAuthor time="3:36 PM" />
          <div className="discord-embed discord-summary" lang="id">
            <h3 className="discord-job-title">{job.title}</h3>
            <p>
              <strong>Peran:</strong> {job.role}
            </p>
            <h4>Kewajiban Utama:</h4>
            <ul>
              {job.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4>Keahlian Tambahan (Nice-to-have):</h4>
            <ul>
              {job.skills.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4>Lokasi:</h4>
            <p>{job.location}</p>
          </div>
        </div>
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
          <KappaMark />
          kappa
        </span>
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
  <div className="showcase-panels">
    <DiscordPreview />
    <DashboardPreview />
  </div>
);
