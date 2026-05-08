import { describe, expect, it } from 'vitest';
import { scorecardSchema } from '@/server/services/bedrock';

describe('scorecardSchema', () => {
  it('accepts a well-formed scorecard', () => {
    const ok = scorecardSchema.safeParse({
      overall_fit_score: 82,
      breakdown: {
        skills_match: { score: 85, reasoning: 'Strong React + TS' },
        experience_match: { score: 80, reasoning: '6 years' },
        education_match: { score: 75, reasoning: 'BTech CSE' },
        domain_alignment: { score: 78, reasoning: 'Wealth-tech adjacent' },
      },
      extracted: {
        years_experience: 6,
        skills: ['react', 'typescript'],
        education: [{ degree: 'BTech CSE', institution: 'IIIT-H', year: 2018 }],
        current_role: 'Senior Engineer',
        current_company: 'Acme',
        location: 'Hyderabad',
        salary_expectation: null,
      },
      red_flags: [],
      agent_recommendation: 'shortlist',
      rationale: 'Strong technical fit.',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects scores outside 0-100', () => {
    const bad = scorecardSchema.safeParse({
      overall_fit_score: 120,
      breakdown: {
        skills_match: { score: 85, reasoning: '' },
        experience_match: { score: 80, reasoning: '' },
        education_match: { score: 75, reasoning: '' },
        domain_alignment: { score: 78, reasoning: '' },
      },
      extracted: {
        years_experience: 6,
        skills: [],
        education: [],
        current_role: '',
        current_company: '',
        location: '',
        salary_expectation: null,
      },
      red_flags: [],
      agent_recommendation: 'shortlist',
      rationale: '',
    });
    expect(bad.success).toBe(false);
  });
});
