import { DetectDocumentTextCommand, TextractClient } from '@aws-sdk/client-textract';
import { getServerEnv } from '@/lib/env';

const env = getServerEnv();
let client: TextractClient | null = null;

function getClient(): TextractClient {
  if (!client) {
    client = new TextractClient({ region: env.AWS_REGION });
  }
  return client;
}

/**
 * Extract text from a resume already uploaded to S3.
 * For multi-page PDFs, use StartDocumentTextDetection async API instead.
 */
export async function extractText(args: { bucket: string; key: string }): Promise<string> {
  const cmd = new DetectDocumentTextCommand({
    Document: { S3Object: { Bucket: args.bucket, Name: args.key } },
  });
  const out = await getClient().send(cmd);
  const lines: string[] = [];
  for (const block of out.Blocks ?? []) {
    if (block.BlockType === 'LINE' && block.Text) {
      lines.push(block.Text);
    }
  }
  return lines.join('\n');
}
