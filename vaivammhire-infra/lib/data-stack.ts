import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface DataStackProps extends cdk.StackProps {
  envName: string;
  vpc: ec2.IVpc;
}

export class DataStack extends cdk.Stack {
  public readonly database: rds.IDatabaseCluster;
  public readonly resumesBucket: s3.IBucket;
  public readonly offersBucket: s3.IBucket;
  public readonly trainingBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const dbKey = new kms.Key(this, 'DbKey', {
      enableKeyRotation: true,
      alias: `alias/vaivammhire-db-${props.envName}`,
    });

    const cluster = new rds.DatabaseCluster(this, 'Cluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_4,
      }),
      serverlessV2MinCapacity: props.envName === 'prod' ? 0.5 : 0,
      serverlessV2MaxCapacity: props.envName === 'prod' ? 8 : 2,
      writer: rds.ClusterInstance.serverlessV2('writer', { autoMinorVersionUpgrade: true }),
      readers: props.envName === 'prod' ? [rds.ClusterInstance.serverlessV2('reader1')] : [],
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      storageEncryptionKey: dbKey,
      backup: { retention: cdk.Duration.days(props.envName === 'prod' ? 30 : 7) },
      deletionProtection: props.envName === 'prod',
      iamAuthentication: true,
      cloudwatchLogsExports: ['postgresql'],
      defaultDatabaseName: 'vaivammhire',
    });

    // pgvector enabled via parameter group migration in app/server/db/migrations.
    this.database = cluster;

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
    new cdk.CfnOutput(this, 'ResumesBucketName', { value: this.resumesBucket.bucketName });
  }
}
