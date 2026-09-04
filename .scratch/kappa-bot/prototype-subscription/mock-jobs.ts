// Throwaway prototype for wayfinder ticket 10 — NOT production code.
// Mock LinkedIn guest cards, shaped exactly like the research-01 cheerio
// parser output (see .scratch/kappa-bot/research-01-linkedin-guest-api.md §4).

export type MockJobPosting = {
  id: string; // numeric urn:li:jobPosting:{id}
  position: string;
  company: string;
  location: string;
  datetime: string | null;
  agoTime: string;
  salary: string | null;
  url: string;
  logo: string | null;
};

// Card 1: real shape observed in the 2026-09-02 live probe.
export const MOCK_JOBS: MockJobPosting[] = [
  {
    id: '4456297886',
    position: 'Entry Level Mechanical Engineer',
    company: 'Schneider',
    location: 'Green Bay, WI',
    datetime: '2026-08-21',
    agoTime: '1 week ago',
    salary: null, // salary badge usually absent on guest cards
    url: 'https://www.linkedin.com/jobs/view/entry-level-mechanical-engineer-at-schneider-4456297886',
    logo: 'https://media.licdn.com/dms/image/company-logo_100_100/schneider',
  },
  {
    id: '4460913082',
    position: 'Controls Engineer',
    company: 'SG Morris',
    location: 'Cleveland, OH',
    datetime: '2026-09-02',
    agoTime: '2 hours ago',
    salary: '$80k–$100k',
    url: 'https://www.linkedin.com/jobs/view/controls-engineer-at-sg-morris-4460913082',
    logo: null, // logo often missing — renderer must tolerate null
  },
];
