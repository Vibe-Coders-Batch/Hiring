import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DataStackProps extends cdk.StackProps {
  envName: string;
  vpc: ec2.IVpc;
}

export class DataStack extends cdk.Stack {
  public readonly database: rds.DatabaseCluster;
  public readonly databaseSecret: secretsmanager.ISecret;
  public readonly resumesBucket: s3.IBucket;
  public readonly offersBucket: s3.IBucket;
  public readonly trainingBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const dbKey = new kms.Key(this, 'DbKey', {
      enableKeyRotation: true,
      alias: `alias/vaivammhire-db-${props.envName}`,
    });

    // Master credentials in Secrets Manager so the bootstrap script can build
    // a working DATABASE_URL without IAM token generation.
    const credentials = rds.Credentials.fromGeneratedSecret('vaivammhire', {
      secretName: `vaivammhire/db/${props.envName}`,
    });

    // Dev/staging put the cluster in PUBLIC subnets so the operator can run
    // schema migrations from their laptop. Prod stays PRIVATE_ISOLATED — for
    // prod, migrations run via a Lambda inside the VPC.
    const isProd = props.envName === 'prod';

    const cluster = new rds.DatabaseCluster(this, 'Cluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      credentials,
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: isProd ? 8 : 2,
      writer: rds.ClusterInstance.serverlessV2('writer', {
        autoMinorVersionUpgrade: true,
        publiclyAccessible: !isProd,
      }),
      readers: isProd ? [rds.ClusterInstance.serverlessV2('reader1')] : [],
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: isProd ? ec2.SubnetType.PRIVATE_ISOLATED : ec2.SubnetType.PUBLIC,
      },
      storageEncryptionKey: dbKey,
      backup: { retention: cdk.Duration.days(isProd ? 30 : 7) },
      deletionProtection: isProd,
      cloudwatchLogsExports: ['postgresql'],
      defaultDatabaseName: 'vaivammhire',
    });

    this.database = cluster;
    if (!cluster.secret) {
      throw new Error('Aurora cluster did not produce a secret');
    }
    this.databaseSecret = cluster.secret;

    const bucketKey = new kms.Key(this, 'S3Key', {
      enableKeyRotation: true,
      alias: `alias/vaivammhire-s3-${props.envName}`,
    });

    const bucketBase = (name: string): s3.BucketProps => ({
      bucketName: `vaivammhire-${name}-${props.envName}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: bucketKey,
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: props.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envName !== 'prod',
    });

    this.resumesBucket = new s3.Bucket(this, 'ResumesBucket', {
      ...bucketBase('resumes'),
      lifecycleRules: [
        {
          // PRD §12.1: 6-month auto-purge of rejected candidates is implemented
          // at the application layer (per-application). Here we expire deleted
          // objects' previous versions after 30 days to keep storage tidy.
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
        {
          transitions: [
            { storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(548) },
          ],
        },
      ],
    });

    this.offersBucket = new s3.Bucket(this, 'OffersBucket', { ...bucketBase('offers') });

    this.trainingBucket = new s3.Bucket(this, 'TrainingBucket', {
      ...bucketBase('training'),
      lifecycleRules: [
        // Archive old labeled snapshots to Glacier after 18 months (PRD §9).
        {
          transitions: [
            { storageClass: s3.StorageClass.GLACIER, transitionAfter: cdk.Duration.days(548) },
          ],
        },
      ],
    });

    new cdk.CfnOutput(this, 'DbEndpoint', { value: cluster.clusterEndpoint.hostname });
    new cdk.CfnOutput(this, 'DbSecretArn', { value: this.databaseSecret.secretArn });
    new cdk.CfnOutput(this, 'DbName', { value: 'vaivammhire' });
    new cdk.CfnOutput(this, 'DbSecurityGroupId', {
      value: cluster.connections.securityGroups[0]?.securityGroupId ?? '',
      description: 'Security group attached to the Aurora cluster — used by aws-setup.sh to allowlist the operator IP in dev.',
    });
    new cdk.CfnOutput(this, 'ResumesBucketName', { value: this.resumesBucket.bucketName });
    new cdk.CfnOutput(this, 'OffersBucketName', { value: this.offersBucket.bucketName });
    new cdk.CfnOutput(this, 'TrainingBucketName', { value: this.trainingBucket.bucketName });
  }
}
