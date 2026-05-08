/**
 * Interview scheduling — propose 3 slots from panel calendars (PRD §6.5, §16.8).
 *
 * Real impl reads HR/hiring-manager Google Calendar via stored OAuth refresh tokens
 * in Secrets Manager and intersects free busy. This stub returns 3 evenly-spaced
 * working-hours slots starting tomorrow so the UI flow can be exercised.
 */

export interface ProposedSlot {
  start: Date;
  end: Date;
  attendees: string[];
}

export async function proposeInterviewSlots(args: {
  applicationId: string;
  panelEmails: string[];
  durationMinutes: number;
}): Promise<{ slots: ProposedSlot[] }> {
  const slots: ProposedSlot[] = [];
  const base = new Date();
  base.setDate(base.getDate() + 1);
  base.setHours(10, 0, 0, 0);

  for (let i = 0; i < 3; i++) {
    const start = new Date(base.getTime() + i * 4 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + args.durationMinutes * 60 * 1000);
    slots.push({ start, end, attendees: args.panelEmails });
  }
  return { slots };
}
