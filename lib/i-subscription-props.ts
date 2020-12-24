export interface ISubscriptionProps {
  apiKey: string,
  subscription: {
    name: string;
    customerId: string;
    region: string;
    resource: {
      protocol: string,
      url: string
    },
    endpoint: {
      protocol: string,
      url: string
    }
  }
};