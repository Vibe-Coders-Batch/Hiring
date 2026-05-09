/**
 * Build the share-link panel data per PRD §6.1.
 */
export interface ShareLinks {
  url: string;
  linkedin: string;
  whatsapp: string;
  emailSignature: string;
}

export function buildShareLinks(slug: string, jobTitle: string, brand = 'Vaivamm Capital'): ShareLinks {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const url = `${base}/jobs/${slug}`;
  return {
    url,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`We're hiring a ${jobTitle} at ${brand}. ${url}`)}`,
    emailSignature: `${brand} is hiring a ${jobTitle}. Apply or share: ${url}`,
  };
}
