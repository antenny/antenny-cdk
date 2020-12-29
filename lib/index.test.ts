import *  as core from '@aws-cdk/core';
import { Subscription } from '../lib/index';

test('Exposes Id attribute', () => {
  const app = new core.App();
  const stack = new core.Stack(app, 'TestStack', {});
  const sub = new Subscription(stack, 'Sub', {
    apiKey: '{testApiKey}',
    subscription: {
      name: '{testSubscription}',
      customerId: '{testCustomerId}',
      region: 'us-east-1',
      resource: {
        protocol: 'ws',
        url: 'wss://example.com'
      },
      endpoint: {
        protocol: 'http',
        url: 'https://example.com'
      }
    }
  });
  expect(typeof sub.attrId).toEqual('object');
});
