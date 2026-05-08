import * as cdk from 'aws-cdk-lib';
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
    const commonEnv: Record<string, string> = {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      ENV_NAME: props.envName,
      RESUMES_BUCKET: props.resumesBucket.bucketName,
      OFFERS_BUCKET: props.offersBucket.bucketName,
      EVENT_BUS_NAME: bus.eventBusName,
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_CANDIDATE_POOL_ID: props.candidatePool.userPoolId,
      DATABASE_SECRET_ARN: props.databaseSecret.secretArn,
    };

    // OpenNext-built Next.js app handler (placeholder asset path until OpenNext build wires up).
    const appHandler = new NodejsFunction(this, 'AppHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      handler: 'handler',
      // OpenNext output: ../vaivammhire-app/.open-next/server-functions/default
      // Until first build, point at a stub so cdk synth still passes.
      entry: './lib/handlers/app-stub.ts',
      environment: commonEnv,
      bundling: { minify: true, target: 'node20', sourceMap: true },
    });
    this.appHandler = appHandler;

    props.resumesBucket.grantReadWrite(appHandler);
    props.offersBucket.grantReadWrite(appHandler);
    props.databaseSecret.grantRead(appHandler);
    bus.grantPutEventsTo(appHandler);
    appHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:vaivammhire/*`],
      }),
    );

    // Allow the app Lambda to talk to Aurora over Postgres on 5432.
    if (props.database instanceof rds.DatabaseCluster) {
      props.database.connections.allowDefaultPortFrom(appHandler);
    }

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
