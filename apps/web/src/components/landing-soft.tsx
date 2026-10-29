import type { ReactNode } from "react";

import { ProductShowcase } from "./product-showcase";

import "./landing-soft.css";

export const LandingSoft = ({
  primaryAction,
}: {
  primaryAction: ReactNode;
}) => (
  <div className="landing-soft">
    <a className="landing-skip" href="#main">
      Skip to content
    </a>
    <header className="landing-nav">
      <nav
        aria-label="Main navigation"
        className="landing-container flex items-center justify-between"
      >
        <a aria-label="Kappa home" className="app-wordmark" href="/">
          <span aria-hidden="true" className="app-logo">
            κ
          </span>
          kappa
        </a>
        <div className="landing-nav-links flex items-center">
          <a href="#showcase">Showcase</a>
          <a href="#faq">FAQ</a>
          <a href="#pricing">Pricing</a>
        </div>
      </nav>
    </header>
    <main id="main">
      <section aria-labelledby="hero-title" className="landing-hero">
        <div className="landing-container">
          <h1 id="hero-title">Your next job, in Discord.</h1>
          <p>Follow the roles you want. Kappa brings new posts to you.</p>
          <div className="landing-actions flex flex-wrap items-center">
            {primaryAction}
            <a className="landing-link" href="#showcase">
              Try the preview
            </a>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="showcase-title"
        className="landing-section showcase-section"
        id="showcase"
      >
        <div className="landing-container">
          <div className="landing-section-head">
            <h2 id="showcase-title">See it before you sign in.</h2>
            <p>Reply in Discord. Browse and manage on the web.</p>
          </div>
          <ProductShowcase />
        </div>
      </section>
      <section
        aria-labelledby="faq-title"
        className="landing-section faq-section"
        id="faq"
      >
        <div className="landing-container landing-faq-grid">
          <h2 id="faq-title">A few things to know.</h2>
          <div className="landing-faq">
            <details open>
              <summary>How do I start?</summary>
              <p>Sign in with Discord and choose your keywords.</p>
            </details>
            <details>
              <summary>Do I need to upload my CV?</summary>
              <p>No. It’s optional.</p>
            </details>
            <details>
              <summary>Can I use it in a server?</summary>
              <p>
                Yes, if you have manage-server permission. Personal CVs stay out
                of server matches.
              </p>
            </details>
            <details>
              <summary>Can I pause a subscription?</summary>
              <p>Yes. Pause or remove it.</p>
            </details>
          </div>
        </div>
      </section>
      <section
        aria-labelledby="pricing-title"
        className="landing-section pricing-section"
        id="pricing"
      >
        <div className="landing-container pricing-grid">
          <div>
            <h2 id="pricing-title">Good jobs. No subscription bill.</h2>
            <p>Everything here is free.</p>
          </div>
          <div className="pricing-offer">
            <h3>Free</h3>
            <p>Job alerts and a web dashboard.</p>
            <ul>
              <li>Personal and server subscriptions</li>
              <li>Optional CV matching</li>
              <li>Pause and manage your alerts</li>
            </ul>
            {primaryAction}
          </div>
        </div>
      </section>
    </main>
    <footer className="landing-footer">
      <div className="landing-container flex flex-wrap items-center justify-between">
        <a aria-label="Kappa home" className="app-wordmark" href="/">
          kappa
        </a>
        <p>Job posts where you already hang out.</p>
        <a className="landing-link" href="#showcase">
          Back to the preview
        </a>
      </div>
    </footer>
  </div>
);
