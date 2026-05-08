import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  envName: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  public readonly candidatePool: cognito.UserPool;
  public readonly candidatePoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    // Admin pool — MFA mandatory (PRD §10.4).
    this.userPool = new cognito.UserPool(this, 'AdminPool', {
      userPoolName: `vaivammhire-admin-${props.envName}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    for (const group of ['admin', 'recruiter', 'hiring_manager', 'interviewer', 'ml_engineer']) {
      new cognito.CfnUserPoolGroup(this, `Group-${group}`, {
        userPoolId: this.userPool.userPoolId,
        groupName: group,
      });
    }

    // Hosted UI domain. Prefix must be globally unique within the region; we
    // append the last 6 of the AWS account ID at synth time so throwaway accounts
    // don't collide with each other.
    const accountSuffix = (process.env.CDK_DEFAULT_ACCOUNT ?? '').slice(-6);
    const domainPrefix = `vaivammhire-${props.envName}${accountSuffix ? `-${accountSuffix}` : ''}`;

    this.userPoolDomain = this.userPool.addDomain('AdminPoolDomain', {
      cognitoDomain: { domainPrefix },
    });

    // Callback URLs cover both local dev and the deployed CloudFront domain.
    // Update via Console after first deploy if you need to add the real CloudFront domain.
    this.userPoolClient = this.userPool.addClient('AdminClient', {
      authFlows: { userSrp: true, userPassword: false },
      generateSecret: false,
      preventUserExistenceErrors: true,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: ['http://localhost:3000/api/auth/callback'],
        logoutUrls: ['http://localhost:3000'],
      },
    });

    // Candidate pool — passwordless email magic-link (PRD §10.4).
    this.candidatePool = new cognito.UserPool(this, 'CandidatePool', {
      userPoolName: `vaivammhire-candidates-${props.envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      mfa: cognito.Mfa.OFF,
      removalPolicy: props.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.candidatePoolClient = this.candidatePool.addClient('CandidateClient', {
      authFlows: { userSrp: true, custom: true },
      generateSecret: false,
    });

    new cdk.CfnOutput(this, 'AdminPoolId', { value: this.userPool.userPoolId });
    new cdk.CfnOutput(this, 'AdminClientId', { value: this.userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'AdminHostedUiDomain', {
      value: `${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
    });
    new cdk.CfnOutput(this, 'AdminHostedUiUrl', {
      value: `https://${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com/login?client_id=${this.userPoolClient.userPoolClientId}&response_type=code&scope=openid+email+profile&redirect_uri=http://localhost:3000/api/auth/callback`,
      description: 'Open this URL in a browser to sign in via Cognito Hosted UI.',
    });
    new cdk.CfnOutput(this, 'CandidatePoolId', { value: this.candidatePool.userPoolId });
  }
}
