import { describe, expect, it } from 'vitest';
import { buildShareLinks } from '@/server/services/share-links';

describe('buildShareLinks', () => {
  it('produces all four share targets', () => {
    const links = buildShareLinks('senior-rm-hyderabad', 'Senior Relationship Manager');
    expect(links.url).toContain('/jobs/senior-rm-hyderabad');
    expect(links.linkedin).toContain('linkedin.com/sharing/share-offsite');
    expect(links.linkedin).toContain(encodeURIComponent('/jobs/senior-rm-hyderabad'));
    expect(links.whatsapp).toContain('wa.me');
    expect(links.emailSignature).toContain('Senior Relationship Manager');
  });
});
