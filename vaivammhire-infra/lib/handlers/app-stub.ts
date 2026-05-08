/**
 * Stub Lambda for the Next.js app handler. The real bundle comes from
 * OpenNext (../vaivammhire-app/.open-next/server-functions/default) — this
 * stub keeps the URL alive and informative while OpenNext wiring is in progress.
 */
const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>VaivammHire — infra deployed</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root { color-scheme: light; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
           margin: 0; padding: 4rem 1.5rem; background: #f8fafc; color: #0f172a; }
    main { max-width: 36rem; margin: 0 auto; }
    h1 { font-size: 1.875rem; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 0.5rem; }
    h2 { font-size: 1.125rem; margin-top: 2rem; }
    p { line-height: 1.6; color: #475569; }
    .badge { display: inline-block; padding: 0.25rem 0.625rem; border-radius: 999px;
             background: #ecfdf5; color: #047857; font-size: 0.75rem; font-weight: 500;
             text-transform: uppercase; letter-spacing: 0.05em; }
    code { background: #e2e8f0; padding: 0.125rem 0.375rem; border-radius: 4px;
           font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.875rem; }
    ul { padding-left: 1.25rem; }
    li { margin: 0.375rem 0; }
    .meta { margin-top: 2rem; font-size: 0.875rem; color: #64748b; }
  </style>
</head>
<body>
  <main>
    <span class="badge">Infrastructure deployed</span>
    <h1>VaivammHire is live on AWS.</h1>
    <p>Lambda + Aurora + S3 + Cognito + CloudFront are up. This page is the placeholder
       served by the app Lambda until the OpenNext build of the Next.js app is wired in.</p>
    <h2>Where to go next</h2>
    <ul>
      <li>Sign in: run <code>make urls</code> and open the Admin Hosted UI link.</li>
      <li>Build the app: <code>cd vaivammhire-app &amp;&amp; pnpm build</code> then redeploy.</li>
      <li>Local dev mirror: <code>make local</code>.</li>
    </ul>
    <p class="meta">Stack family: <code>VaivammHire-*-${process.env.ENV_NAME ?? 'dev'}</code></p>
  </main>
</body>
</html>`;

export async function handler(_event: unknown) {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60',
    },
    body: PAGE,
  };
}
