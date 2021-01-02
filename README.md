# antenny-cdk

antenny-cdk is a cloud development kit construct library for Antenny. It provides a way to integrate Antenny into your cdk infrastructure.

## Installation

#### npm

```shell
npm install antenny-cdk --save
```

#### pip

```shell
pip install antenny-cdk
```

#### nuget

```shell
dotnet add package Antenny.Cdk
```

## Usage

To create a subscription in your aws-cdk project:

```javascript
const antenny = require('antenny-cdk');

const sub = new antenny.Subscription(this, 'Sub', {
  apiKey: '{api-key}',
  subscription: {
    name: 'example-subscription',
    customerId: '{customerId}',
    region: '{aws-region}',
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
```

There is also a real world example included in our [sample-app](https://github.com/antenny/sample-app).