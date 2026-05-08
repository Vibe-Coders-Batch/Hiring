import * as cdk from 'aws-cdk-lib';
import * as cw from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { Construct } from 'constructs';

export interface ObservabilityStackProps extends cdk.StackProps {
  envName: string;
  appHandler: lambda.IFunction;
  database: rds.IDatabaseCluster;
}

export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const alarmsTopic = new sns.Topic(this, 'AlarmsTopic', {
      topicName: `vaivammhire-alarms-${props.envName}`,
    });
    // Subscribers (Slack via AWS Chatbot) wired in via console or a separate stack.

    const dashboard = new cw.Dashboard(this, 'Dashboard', {
      dashboardName: `VaivammHire-${props.envName}`,
    });

    dashboard.addWidgets(
      new cw.GraphWidget({
        title: 'App Lambda — invocations + errors',
        left: [props.appHandler.metricInvocations()],
        right: [props.appHandler.metricErrors()],
      }),
      new cw.GraphWidget({
        title: 'App Lambda — duration p95',
        left: [props.appHandler.metricDuration({ statistic: 'p95' })],
      }),
    );

    new cw.Alarm(this, 'AppErrorRate', {
      metric: props.appHandler.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: 'App Lambda errors >5 in 10 min',
    }).addAlarmAction(new cwActions.SnsAction(alarmsTopic));

    // Synthetics canary on the public job board (PRD §10.6).
    new synthetics.Canary(this, 'JobsCanary', {
      schedule: synthetics.Schedule.rate(cdk.Duration.minutes(10)),
      test: synthetics.Test.custom({
        code: synthetics.Code.fromInline(
          `const synthetics = require('Synthetics');
           exports.handler = async () => {
             const page = await synthetics.getPage();
             const url = process.env.TARGET_URL || 'https://hiring.vaivammcapital.com/jobs';
             await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
           };`,
        ),
        handler: 'index.handler',
      }),
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PUPPETEER_7_0,
    });

    // Budget alarms (PRD §16.3).
    new budgets.CfnBudget(this, 'SageMakerBudget', {
      budget: {
        budgetName: `vaivammhire-sagemaker-${props.envName}`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: 300, unit: 'USD' },
        costFilters: { Service: ['Amazon SageMaker'] },
      },
      notificationsWithSubscribers: [
        {
          notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 80 },
          subscribers: [{ subscriptionType: 'SNS', address: alarmsTopic.topicArn }],
        },
      ],
    });

    new cdk.CfnOutput(this, 'AlarmsTopicArn', { value: alarmsTopic.topicArn });
  }
}
