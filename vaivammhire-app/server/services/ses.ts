import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getServerEnv } from '@/lib/env';

const env = getServerEnv();
let client: SESClient | null = null;

function getClient(): SESClient {
  if (!client) client = new SESClient({ region: env.AWS_REGION });
  return client;
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
}): Promise<{ messageId?: string }> {
  const cmd = new SendEmailCommand({
    Source: env.SES_FROM_ADDRESS,
    ReplyToAddresses: env.SES_REPLY_TO ? [env.SES_REPLY_TO] : undefined,
    Destination: { ToAddresses: [args.to] },
    Message: {
      Subject: { Data: args.subject, Charset: 'UTF-8' },
      Body: {
        Text: { Data: args.body, Charset: 'UTF-8' },
        ...(args.htmlBody ? { Html: { Data: args.htmlBody, Charset: 'UTF-8' } } : {}),
      },
    },
  });
  const out = await getClient().send(cmd);
  return { messageId: out.MessageId };
}
