import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getServerEnv } from '@/lib/env';

const env = getServerEnv();
let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) client = new S3Client({ region: env.AWS_REGION });
  return client;
}

/**
 * Returns a 15-minute pre-signed PUT URL for the candidate to upload their resume directly to S3
 * (PRD §6.2 + §12.3). Files >5 MB are rejected by the form.
 */
export async function presignResumeUpload(args: { contentType: string; ext: 'pdf' | 'docx' }) {
  const key = `incoming/${crypto.randomUUID()}.${args.ext}`;
  const cmd = new PutObjectCommand({
    Bucket: env.S3_RESUMES_BUCKET,
    Key: key,
    ContentType: args.contentType,
  });
  const url = await getSignedUrl(getClient(), cmd, { expiresIn: 900 });
  return { url, key, bucket: env.S3_RESUMES_BUCKET };
}

export async function presignResumeDownload(key: string) {
  const cmd = new GetObjectCommand({ Bucket: env.S3_RESUMES_BUCKET, Key: key });
  return getSignedUrl(getClient(), cmd, { expiresIn: 900 });
}
