import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  envName: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
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

    this.userPoolClient = this.userPool.addClient('AdminClient', {
      authFlows: { userSrp: true, userPassword: false },
      generateSecret: false,
      preventUserExistenceErrors: true,
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
    new cdk.CfnOutput(this, 'CandidatePoolId', { value: this.candidatePool.userPoolId });
  }
}
