# Test fixture resumes (PRD §19.2)

Tarun-provided sample resumes covering diverse roles, languages, and quality levels.

## Required coverage

- 5–10 strong candidates across (RM, analyst, ops, tech, intern)
- 5–10 medium candidates
- 5–10 weak candidates
- At least 3 with English/Hinglish names
- At least 2 with parsing pitfalls (non-standard layout, multi-column PDFs)

For each fixture, add an expected JSON in `../expected/<basename>.json` with:

```json
{
  "years_experience": 6,
  "top_skills": ["react", "typescript", "..."],
  "education_degree": "BTech CSE",
  "education_institution": "IIIT-H",
  "fit_decision_for_jd_<jd_slug>": "shortlist | review | reject"
}
```

The eval test (`tests/e2e/resume-fixture-eval.spec.ts`, ships in Phase 2) runs the
prod pipeline against every fixture and asserts:

- years experience within ±1
- ≥80% recall on top skills
- education degree+institution matched
- fit decision matches HR's

Block merge if regression > 5%.

**These fixtures are committed; never put real candidate data here.** Use synthetic
or explicitly-consented samples only. The `Naukri Sales Profiles/` directory at the
repo root is git-ignored for exactly this reason.
