import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { SecretValue } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as integ from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface ComputeStackProps extends cdk.StackProps {
  envName: string;
  vpc: ec2.IVpc;
  database: rds.IDatabaseCluster;
  databaseSecret: secretsmanager.ISecret;
  resumesBucket: s3.IBucket;
  offersBucket: s3.IBucket;
  trainingBucket: s3.IBucket;
  userPool: cognito.IUserPool;
  candidatePool: cognito.IUserPool;
  bedrockInvokeRole: iam.IRole;
}

export class ComputeStack extends cdk.Stack {
  public readonly appHandler: lambda.IFunction;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // EventBridge bus — every domain event flows through here.
    const bus = new events.EventBus(this, 'Bus', { eventBusName: `vaivammhire-${props.envName}` });

    // DLQ for screening pipeline failures.
    const screeningDlq = new sqs.Queue(this, 'ScreeningDlq', {
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
    });

    // Common Lambda env applied to every function.
    const databaseUrl = cdk.Fn.join('', [
      'postgresql://',
      SecretValue.secretsManager(props.databaseSecret.secretArn, { jsonField: 'username' }).unsafeUnwrap(),
      ':',
      SecretValue.secretsManager(props.databaseSecret.secretArn, { jsonField: 'password' }).unsafeUnwrap(),
      '@',
      SecretValue.secretsManager(props.databaseSecret.secretArn, { jsonField: 'host' }).unsafeUnwrap(),
      ':',
      SecretValue.secretsManager(props.databaseSecret.secretArn, { jsonField: 'port' }).unsafeUnwrap(),
      '/',
      SecretValue.secretsManager(props.databaseSecret.secretArn, { jsonField: 'dbname' }).unsafeUnwrap(),
      '?sslmode=require',
    ]);

    const commonEnv: Record<string, string> = {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      ENV_NAME: props.envName,
      DATABASE_URL: databaseUrl as unknown as string,
      DATABASE_SECRET_ARN: props.databaseSecret.secretArn,
      S3_RESUMES_BUCKET: props.resumesBucket.bucketName,
      S3_OFFERS_BUCKET: props.offersBucket.bucketName,
      S3_TRAINING_BUCKET: props.trainingBucket.bucketName,
      SES_FROM_ADDRESS: `noreply-hiring-${props.envName}@example.com`,
      SES_REPLY_TO: `hr-${props.envName}@example.com`,
      EVENT_BUS_NAME: bus.eventBusName,
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_CANDIDATE_POOL_ID: props.candidatePool.userPoolId,
    };

    const openNextServerPath = path.join(
      __dirname,
      '..',
      '..',
      'vaivammhire-app',
      '.open-next',
      'server-functions',
      'default',
    );
    const useOpenNextBundle = fs.existsSync(openNextServerPath);

    const appHandler = useOpenNextBundle
      ? new lambda.Function(this, 'AppHandler', {
          runtime: lambda.Runtime.NODEJS_20_X,
          handler: 'index.handler',
          code: lambda.Code.fromAsset(openNextServerPath),
          memorySize: 1536,
          timeout: cdk.Duration.seconds(60),
          vpc: props.vpc,
          vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          environment: commonEnv,
          tracing: lambda.Tracing.ACTIVE,
        })
      : new NodejsFunction(this, 'AppHandler', {
          runtime: lambda.Runtime.NODEJS_20_X,
          memorySize: 1024,
          timeout: cdk.Duration.seconds(30),
          vpc: props.vpc,
          vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
          handler: 'handler',
          entry: './lib/handlers/app-stub.ts',
          environment: commonEnv,
          bundling: { minify: true, target: 'node20', sourceMap: true },
        });
    this.appHandler = appHandler;

    props.resumesBucket.grantReadWrite(appHandler);
    props.offersBucket.grantReadWrite(appHandler);
    props.trainingBucket.grantRead(appHandler);
    props.databaseSecret.grantRead(appHandler);
    bus.grantPutEventsTo(appHandler);
    appHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:vaivammhire/*`],
      }),
    );
    appHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:Converse', 'bedrock:ConverseStream'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.*`,
          `arn:aws:bedrock:ap-southeast-1::foundation-model/anthropic.*`,
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-*`,
        ],
      }),
    );
    appHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }),
    );

    // Note: Aurora is publicly accessible in dev/staging with an IP-allowlisted SG
    // (see data-stack + aws-setup.sh). The app Lambda reaches it over the internet
    // via NAT for now. We deliberately don't add a Lambda-SG → DB-SG ingress rule
    // here because that creates a Data ↔ Compute stack dependency cycle in CDK
    // (Data already depends on Compute via the AppHandler SG; adding the reverse
    // would deadlock synth). Wire this back up via a shared SG construct in a
    // future cleanup if we move Aurora back into a private subnet.

    // HTTP API Gateway for webhooks (Documenso e-sign, WhatsApp inbound, Cognito hooks).
    const httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: `vaivammhire-webhooks-${props.envName}`,
      corsPreflight: { allowOrigins: ['*'], allowMethods: [apigw.CorsHttpMethod.POST] },
    });

    httpApi.addRoutes({
      path: '/webhooks/{provider}',
      methods: [apigw.HttpMethod.POST],
      integration: new integ.HttpLambdaIntegration('WebhooksInteg', appHandler),
    });

    // ── Screening pipeline Step Functions (PRD §6.3) ────────────────────────
    // S3 ObjectCreated → EventBridge rule → Step Functions → Textract → Bedrock → DB.
    // The AI policies live inline here (not via the cross-stack BedrockInvokeRole)
    // to avoid a Compute → AI → DLQ dependency cycle.
    const screeningHandler = new NodejsFunction(this, 'ScreeningHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      handler: 'handler',
      entry: './lib/handlers/screening-stub.ts',
      environment: commonEnv,
      deadLetterQueue: screeningDlq,
    });
    props.resumesBucket.grantRead(screeningHandler);
    props.databaseSecret.grantRead(screeningHandler);

    screeningHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:Converse', 'bedrock:ConverseStream'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.*`,
          `arn:aws:bedrock:ap-southeast-1::foundation-model/anthropic.*`,
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-*`,
        ],
      }),
    );
    screeningHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'textract:DetectDocumentText',
          'textract:AnalyzeDocument',
          'textract:StartDocumentTextDetection',
          'textract:GetDocumentTextDetection',
        ],
        resources: ['*'],
      }),
    );
    screeningHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['comprehend:DetectEntities', 'comprehend:DetectPiiEntities'],
        resources: ['*'],
      }),
    );

    const definition = new tasks.LambdaInvoke(this, 'RunScreening', {
      lambdaFunction: screeningHandler,
      outputPath: '$.Payload',
    }).addRetry({ maxAttempts: 3, backoffRate: 2, interval: cdk.Duration.seconds(10) });

    const screeningSm = new sfn.StateMachine(this, 'ScreeningSm', {
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(15),
      tracingEnabled: true,
    });

    new events.Rule(this, 'ResumeUploadedRule', {
      eventBus: bus,
      eventPattern: { source: ['aws.s3'], detailType: ['Object Created'] },
      targets: [new eventsTargets.SfnStateMachine(screeningSm)],
    });

    new cdk.CfnOutput(this, 'AppHandlerArn', { value: appHandler.functionArn });
    new cdk.CfnOutput(this, 'WebhooksUrl', { value: httpApi.apiEndpoint });
  }
}
