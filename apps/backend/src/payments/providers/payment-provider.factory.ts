import { Inject, Injectable } from '@nestjs/common';
import { PaymentProviderName } from '../payments.enums';
import { PaymentProviderStrategy } from './payment-provider.strategy';

@Injectable()
export class PaymentProviderFactory {
  private readonly strategies = new Map<PaymentProviderName, PaymentProviderStrategy>();

  constructor(
    @Inject('PAYMENT_PROVIDER_STRATEGIES')
    strategies: PaymentProviderStrategy[],
  ) {
    strategies.forEach((strategy) => {
      this.strategies.set(strategy.providerName, strategy);
    });
  }

  getProvider(providerName: PaymentProviderName): PaymentProviderStrategy {
    const strategy = this.strategies.get(providerName);
    if (!strategy) {
      throw new Error(`Unsupported payment provider: ${providerName}`);
    }
    return strategy;
  }
}
