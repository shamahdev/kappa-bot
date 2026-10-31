# CV matching rubric

## User-approved scope

Grades A–E; factors are skills, relevant experience, and keyword match. The user delegated custom weighting to product judgment/research. CV extraction remains private; only uploaded status, filename and upload date are exposed by CV endpoints.

## Evidence and interpretation

- [OPM, Job Analysis](https://www.opm.gov/policy-data-oversight/assessment-and-selection/job-analysis/): job analysis connects actual job tasks with the competencies required to perform them and forms the foundation of assessment/selection. This supports prioritizing job-relevant capabilities over identical résumé wording.
- [OPM, Training and Experience Evaluations](https://www.opm.gov/policy-data-oversight/assessment-and-selection/other-assessment-methods/training-and-experience-evaluations/): factors should derive from critical job requirements and consider amount and quality of relevant experience. OPM also cautions about the low validity of traditional rating schedules and inflated self-reports.

These sources support the priority order, not universal percentage weights or a scientifically calibrated letter scale. Keyword matching's subordinate role is our inference from the task/competency framework. No claim is made that this CV matcher predicts job performance or hiring decisions.

## Product heuristic

- **Skills: 50%** — primary signal: job-required capabilities supported by demonstrated work, recognizing equivalent terminology.
- **Relevant experience: 35%** — substantial corroboration: responsibilities, applied experience and transferable projects.
- **Keyword match: 15%** — secondary signal: meaningful role/domain/technology terminology. Ignore repetition and boilerplate; keyword stuffing must not inflate the other factors.

The allocation puts 85% on capabilities and applied experience, leaving 15% for terminology coverage. These exact percentages are the product choice authorized by the requester, not figures attributed to OPM. All factors are evaluated against the full extracted CV and full source posting. Repeated statements are not additional evidence; missing evidence is not proof of inability. Reasons are job-focused, without CV quotations or personal details.

Factor anchors: 0 no supporting evidence; 25 limited overlap; 50 partial alignment; 75 good coverage with gaps; 100 clear coverage of stated requirements. Weighted total is rounded once. Five equal-width bands cover that 0–100 rubric: A 80–100 (strong), B 60–79 (good), C 40–59 (partial), D 20–39 (limited), E 0–19 (weak). These bands are a transparent product convention, not empirical selection cutoffs. Show no grade if assessment fails rather than pretending a truncated CV was assessed.

Legacy percentage history maps to letters but has no invented factor breakdown. Future assessments store the breakdown alongside the existing internal numeric score. CV replacement does not retroactively rescore historical deliveries.
