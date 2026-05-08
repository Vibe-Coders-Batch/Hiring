#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DataStack } from '../lib/data-stack';
import { AuthStack } from '../lib/auth-stack';
import { ComputeStack } from '../lib/compute-stack';
import { FrontendStack } from '../lib/frontend-stack';
import { AiStack } from '../lib/ai-stack';
import { ObservabilityStack } from '../lib/observability-stack';

const app = new cdk.App();

const envName = (app.node.tryGetContext('env') as string | undefined) ?? 'dev';
const region = process.env.CDK_DEFAULT_REGION ?? 'ap-south-1';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const env = { account, region };

cdk.Tags.of(app).add('project', 'vaivammhire');
cdk.Tags.of(app).add('env', envName);
cdk.Tags.of(app).add('owner', 'tarun');

const network = new NetworkStack(app, `VaivammHire-Network-${envName}`, { env, envName });

const data = new DataStack(app, `VaivammHire-Data-${envName}`, {
  env,
  envName,
  vpc: network.vpc,
});

const auth = new AuthStack(app, `VaivammHire-Auth-${envName}`, { env, envName });

const ai = new AiStack(app, `VaivammHire-AI-${envName}`, {
  env,
  envName,
  trainingBucket: data.trainingBucket,
});

const compute = new ComputeStack(app, `VaivammHire-Compute-${envName}`, {
  env,
  envName,
  vpc: network.vpc,
  database: data.database,
  databaseSecret: data.databaseSecret,
  resumesBucket: data.resumesBucket,
  offersBucket: data.offersBucket,
  userPool: auth.userPool,
  candidatePool: auth.candidatePool,
  bedrockInvokeRole: ai.bedrockInvokeRole,
});

new FrontendStack(app, `VaivammHire-Frontend-${envName}`, {
  env,
  envName,
  apiHandler: compute.appHandler,
});

new ObservabilityStack(app, `VaivammHire-Observability-${envName}`, {
  env,
  envName,
  appHandler: compute.appHandler,
  database: data.database,
});

app.synth();
