import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkStackProps extends cdk.StackProps {
  envName: string;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: props.envName === 'prod' ? 2 : 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    // Gateway endpoints (free) for S3 + DynamoDB.
    vpc.addGatewayEndpoint('S3Endpoint', { service: ec2.GatewayVpcEndpointAwsService.S3 });

    // Interface endpoints for AWS APIs the app calls — keeps traffic on the AWS network.
    // Each interface endpoint is ~$7/month idle, so we add only what the hot path needs.
    // Skipped: SES (we use the API not SMTP, and outbound SES via NAT works fine for now).
    if (props.envName === 'prod') {
      vpc.addInterfaceEndpoint('BedrockEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.BEDROCK_RUNTIME });
      vpc.addInterfaceEndpoint('TextractEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.TEXTRACT });
      vpc.addInterfaceEndpoint('ComprehendEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.COMPREHEND });
      vpc.addInterfaceEndpoint('SecretsManagerEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER });
    }
    // In dev/staging the Lambda reaches AWS APIs via NAT — slightly slower, much cheaper.

    this.vpc = vpc;
  }
}
