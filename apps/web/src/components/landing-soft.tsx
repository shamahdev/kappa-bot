import type { ReactNode } from "react";

import { KappaMark } from "./kappa-mark";
import { ProductShowcase } from "./product-showcase";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./shadcn/accordion";

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
      <nav aria-label="Main navigation" className="landing-container">
        <a aria-label="Kappa home" className="app-wordmark" href="/">
          <KappaMark />
          kappa
        </a>
        <div className="landing-nav-links">
          <a href="#showcase">Preview</a>
          <a href="#faq">FAQ</a>
          <a href="#pricing">Pricing</a>
        </div>
      </nav>
    </header>
    <main id="main">
      <section aria-labelledby="hero-title" className="landing-hero">
        <div className="landing-container">
          <div className="landing-hero-heading">
            <h1 id="hero-title">
              Job matches,
              <span>delivered to you.</span>
            </h1>
            <KappaMark className="landing-mascot" />
          </div>
          <div className="landing-hero-bottom">
            <p>
              Get notified in Discord when new jobs match your keywords or CV.
              Spend less time checking job sites.
            </p>
            <div className="landing-actions">{primaryAction}</div>
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
            <h2 id="showcase-title">Get notified while you’re away.</h2>
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
          {/* shadcn Accordion; answers stay in the HTML for search engines. */}
          <Accordion
            className="landing-faq"
            defaultValue={["start"]}
            type="multiple"
          >
            <AccordionItem value="start">
              <AccordionTrigger>How do I start?</AccordionTrigger>
              <AccordionContent forceMount>
                <p>Sign in with Discord and choose your keywords.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cv">
              <AccordionTrigger>Do I need to upload my CV?</AccordionTrigger>
              <AccordionContent forceMount>
                <p>No. CV matching is optional.</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="server">
              <AccordionTrigger>Can I use it in a server?</AccordionTrigger>
              <AccordionContent forceMount>
                <p>
                  Yes, if you have manage-server permission. Personal CVs stay
                  out of server matches.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="pause">
              <AccordionTrigger>Can I pause a subscription?</AccordionTrigger>
              <AccordionContent forceMount>
                <p>Yes. You can pause or remove a subscription.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
      <section
        aria-labelledby="pricing-title"
        className="landing-section pricing-section"
        id="pricing"
      >
        <div className="landing-container">
          <div className="pricing-intro">
            <h2 id="pricing-title">Start free. Get more control.</h2>
          </div>
          <div className="pricing-grid">
            <article
              aria-labelledby="free-plan-title"
              className="pricing-offer"
            >
              <div className="pricing-plan-heading">
                <h3 id="free-plan-title">Free</h3>
              </div>
              <p>Job alerts and a web dashboard.</p>
              <ul>
                <li>Personal and server subscriptions</li>
                <li>Optional CV matching</li>
                <li>Pause and manage your alerts</li>
              </ul>
            </article>
            <article
              aria-labelledby="premium-plan-title"
              className="pricing-offer pricing-premium"
            >
              <div className="pricing-plan-heading">
                <h3 id="premium-plan-title">Premium</h3>
                <span className="pricing-plan-status">[Coming Soon]</span>
              </div>
              <p>More ways to receive and personalize your job alerts.</p>
              <ul>
                <li>Subscriptions to multiple channels via webhooks</li>
                <li>Configurable notification times</li>
                <li>Automatic keywords from your CV</li>
              </ul>
            </article>
          </div>
        </div>
      </section>
    </main>
    <footer className="landing-footer">
      <div className="landing-container">
        <a aria-label="Kappa home" className="app-wordmark" href="/">
          <KappaMark />
          kappa
        </a>
      </div>
    </footer>
  </div>
);
