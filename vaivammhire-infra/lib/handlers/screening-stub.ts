/**
 * Stub for the screening Lambda. Real implementation imports
 * `runScreening` from vaivammhire-app/server/services/screening-pipeline.ts
 * (bundled into the deployment artifact).
 */
export async function handler(event: { applicationId?: string; bucket?: string; key?: string }) {
  console.log('screening handler stub', event);
  return { ok: true };
}
