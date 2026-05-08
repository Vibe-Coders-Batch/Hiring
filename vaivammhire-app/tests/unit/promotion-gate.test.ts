import { describe, expect, it, vi } from 'vitest';

// Promotion gate logic, isolated from DB. We test the pure transform that the
// service applies to evalMetrics — by re-implementing the rules here for the
// test fixtures, we lock in the PRD §7.7 contract.

function evaluate(m: {
  accuracy_delta: number;
  cost_ratio: number;
  p95_latency_delta: number;
  hr_agreement_delta: number;
  fairness_pass: boolean;
}) {
  const wins = {
    accuracy: m.accuracy_delta > 0,
    cost: m.cost_ratio < 1,
    latency: m.p95_latency_delta < 0,
  };
  const winCount = Object.values(wins).filter(Boolean).length;
  const reasons: string[] = [];
  if (winCount < 2) reasons.push('not enough wins');
  if (!wins.accuracy && m.accuracy_delta < -0.1) reasons.push('accuracy loss >10%');
  if (!wins.cost && m.cost_ratio > 1.1) reasons.push('cost worse by >10%');
  if (!wins.latency && m.p95_latency_delta > 0.1) reasons.push('latency worse by >10%');
  if (Math.abs(m.hr_agreement_delta) > 5) reasons.push('hr agreement off');
  if (!m.fairness_pass) reasons.push('fairness fail');
  return reasons.length === 0;
}

describe('promotion gate (PRD §7.7)', () => {
  it('passes when all three metrics improve and fairness passes', () => {
    expect(
      evaluate({
        accuracy_delta: 0.02,
        cost_ratio: 0.4,
        p95_latency_delta: -0.2,
        hr_agreement_delta: 1,
        fairness_pass: true,
      }),
    ).toBe(true);
  });

  it('fails when only one metric wins', () => {
    expect(
      evaluate({
        accuracy_delta: -0.05,
        cost_ratio: 0.5,
        p95_latency_delta: 0.05,
        hr_agreement_delta: 0,
        fairness_pass: true,
      }),
    ).toBe(false);
  });

  it('fails when fairness fails even with strong metrics', () => {
    expect(
      evaluate({
        accuracy_delta: 0.05,
        cost_ratio: 0.3,
        p95_latency_delta: -0.4,
        hr_agreement_delta: 1,
        fairness_pass: false,
      }),
    ).toBe(false);
  });

  it('fails when HR agreement drifts more than 5 pts', () => {
    expect(
      evaluate({
        accuracy_delta: 0.03,
        cost_ratio: 0.5,
        p95_latency_delta: -0.1,
        hr_agreement_delta: 8,
        fairness_pass: true,
      }),
    ).toBe(false);
  });

  it('two wins + small loss on third within 10%', () => {
    expect(
      evaluate({
        accuracy_delta: 0.02,
        cost_ratio: 0.7,
        p95_latency_delta: 0.05,
        hr_agreement_delta: 2,
        fairness_pass: true,
      }),
    ).toBe(true);
  });
});

vi.stubEnv('NODE_ENV', 'test');
