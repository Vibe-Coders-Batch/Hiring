import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface AiStackProps extends cdk.StackProps {
  envName: string;
  trainingBucket: s3.IBucket;
}

export class AiStack extends cdk.Stack {
  public readonly bedrockInvokeRole: iam.Role;
  public readonly sageMakerExecutionRole: iam.Role;
  public readonly mlContainerRepo: ecr.IRepository;

  constructor(scope: Construct, id: string, props: AiStackProps) {
    super(scope, id, props);

    // Role assumed by Lambdas that call Bedrock + Textract + Comprehend.
    this.bedrockInvokeRole = new iam.Role(this, 'BedrockInvokeRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('lambda.amazonaws.com'),
        new iam.ServicePrincipal('states.amazonaws.com'),
      ),
      description: 'Invokes Bedrock + Textract + Comprehend for the screening pipeline.',
    });

    // Bedrock invoke permissions, scoped to Anthropic models.
    this.bedrockInvokeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:Converse', 'bedrock:ConverseStream'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.*`,
          `arn:aws:bedrock:ap-southeast-1::foundation-model/anthropic.*`, // fallback per PRD §20.4
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-*`,
        ],
      }),
    );

    this.bedrockInvokeRole.addToPolicy(
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

    this.bedrockInvokeRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['comprehend:DetectEntities', 'comprehend:DetectPiiEntities'],
        resources: ['*'],
      }),
    );

    // SageMaker execution role for Track B training pipelines (PRD §7.5).
    this.sageMakerExecutionRole = new iam.Role(this, 'SageMakerExecutionRole', {
      assumedBy: new iam.ServicePrincipal('sagemaker.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSageMakerFullAccess'),
      ],
    });
    props.trainingBucket.grantReadWrite(this.sageMakerExecutionRole);

    // ECR repo for custom training/inference container images.
    this.mlContainerRepo = new ecr.Repository(this, 'MlContainers', {
      repositoryName: `vaivammhire-ml-${props.envName}`,
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 30 }],
      removalPolicy: props.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, 'EcrRepoUri', { value: this.mlContainerRepo.repositoryUri });
    new cdk.CfnOutput(this, 'SageMakerRoleArn', { value: this.sageMakerExecutionRole.roleArn });
  }
}
