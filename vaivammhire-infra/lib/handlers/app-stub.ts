/**
 * Stub Lambda for the Next.js app handler. The real bundle is produced by
 * OpenNext into ../vaivammhire-app/.open-next/server-functions/default and
 * wired into ComputeStack at deploy time.
 */
export async function handler(event: unknown) {
  console.log('app handler stub', event);
  return {
    statusCode: 200,
    headers: { 'content-type': 'text/plain' },
    body: 'VaivammHire app handler — wire OpenNext output here.',
  };
}
