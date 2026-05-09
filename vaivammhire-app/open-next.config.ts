import type { OpenNextConfig } from '@opennextjs/aws/types/open-next';

/**
 * AWS Lambda Function URL + CloudFront (see vaivammhire-infra FrontendStack).
 * Default converter aws-apigw-v2 matches Lambda Function URL payload format.
 *
 * Tag/incremental caches disabled here so deploy does not require extra DynamoDB/SQS wiring;
 * re-enable and add resources when you need full ISR/revalidateTag on Lambda.
 */
const config = {
  default: {
    override: {
      wrapper: 'aws-lambda-streaming',
      converter: 'aws-apigw-v2',
    },
  },
  dangerous: {
    disableTagCache: true,
    disableIncrementalCache: true,
  },
  /** Ensures `lib/env` receives placeholders during static analysis (see OPENNEXT_BUILD). */
  buildCommand: 'OPENNEXT_BUILD=1 NEXT_PUBLIC_APP_URL=http://localhost:3000 pnpm exec next build',
} satisfies OpenNextConfig;

export default config;
