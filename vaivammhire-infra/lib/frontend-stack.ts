import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  envName: string;
  apiHandler: lambda.IFunction;
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const staticBucket = new s3.Bucket(this, 'StaticBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: props.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envName !== 'prod',
    });

    // WAF managed rule sets in front of CloudFront (PRD §10.4).
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `vaivammhire-${props.envName}`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWS-Common',
          priority: 0,
          statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesCommonRuleSet' } },
          overrideAction: { none: {} },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'common', sampledRequestsEnabled: true },
        },
        {
          name: 'AWS-AmazonIpReputation',
          priority: 1,
          statement: { managedRuleGroupStatement: { vendorName: 'AWS', name: 'AWSManagedRulesAmazonIpReputationList' } },
          overrideAction: { none: {} },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'ip-rep', sampledRequestsEnabled: true },
        },
        {
          name: 'RateLimitApply',
          priority: 2,
          // PRD §12.3: 10 requests/IP/hour on the apply form. WAF rate-limit is per 5 min;
          // setting limit=50/5min ≈ 10/hour for sustained traffic.
          statement: {
            rateBasedStatement: {
              limit: 50,
              aggregateKeyType: 'IP',
              scopeDownStatement: {
                byteMatchStatement: {
                  fieldToMatch: { uriPath: {} },
                  positionalConstraint: 'STARTS_WITH',
                  searchString: '/api/applications/',
                  textTransformations: [{ priority: 0, type: 'NONE' }],
                },
              },
            },
          },
          action: { block: {} },
          visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'apply-rate', sampledRequestsEnabled: true },
        },
      ],
    });

    const apiOrigin = new origins.FunctionUrlOrigin(
      props.apiHandler.addFunctionUrl({ authType: lambda.FunctionUrlAuthType.NONE }),
    );

    const distribution = new cf.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: apiOrigin,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cf.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      additionalBehaviors: {
        '/_next/static/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(staticBucket),
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
        },
        '/static/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(staticBucket),
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      webAclId: webAcl.attrArn,
      priceClass: cf.PriceClass.PRICE_CLASS_100,
      httpVersion: cf.HttpVersion.HTTP2_AND_3,
      minimumProtocolVersion: cf.SecurityPolicyProtocol.TLS_V1_2_2021,
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'StaticBucketName', { value: staticBucket.bucketName });
  }
}
