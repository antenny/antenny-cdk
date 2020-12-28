import * as fs from 'fs';
import * as path from 'path';
import * as core from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as logs from '@aws-cdk/aws-logs';
import * as lambda from '@aws-cdk/aws-lambda';
import * as cr from '@aws-cdk/custom-resources';

export interface IResourceProps {
  readonly protocol: string,
  readonly url: string
};

export interface ISubscription {
  readonly name: string,
  readonly customerId: string,
  readonly region: string,
  readonly resource: IResourceProps,
  readonly endpoint: IResourceProps
};

export interface ISubscriptionProps {
  readonly apiKey: string,
  readonly subscription: ISubscription
};

export class Subscription extends core.Construct {
  public attrId: core.Reference;

  constructor(scope: core.Construct, id: string,
    props: ISubscriptionProps) {
    super(scope, id);
    const subFnRole = new iam.Role(this, 'SubFnRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        )
      ]
    });
    const subFn = new lambda.SingletonFunction(this, 'SubFn', {
      uuid: 'a543ec4b-4a7f-41e5-bfd9-3788dda240ce',
      role: subFnRole,
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      memorySize: 128,
      timeout: core.Duration.seconds(30),
      code: lambda.Code.fromInline(fs.readFileSync(path.join(
        __dirname,
        'function',
        'index.js'
      ), { encoding: 'utf8' })),
      environment: {
        API_KEY: props.apiKey
      }
    });
    const subProv = new cr.Provider(this, 'SubProvider', {
      onEventHandler: subFn,
      logRetention: logs.RetentionDays.ONE_WEEK
    });
    const subRes = new core.CustomResource(this, 'SubRes', {
      serviceToken: subProv.serviceToken,
      pascalCaseProperties: true,
      properties: {
        subscription: JSON.stringify(props.subscription)
      }
    });
    this.attrId = subRes.getAtt('Id');
  }
}