import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestStore {
  correlationId: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestStore>();

export class RequestContext {
  /**
   * Run callback within a scoped asynchronous request context.
   */
  static run<T>(store: RequestStore, callback: () => T): T {
    return asyncLocalStorage.run(store, callback);
  }

  /**
   * Retrieve the active request store, if within a request context.
   */
  static getStore(): RequestStore | undefined {
    return asyncLocalStorage.getStore();
  }

  /**
   * Retrieve the active correlation ID, or undefined if outside request scope.
   */
  static getCorrelationId(): string | undefined {
    return asyncLocalStorage.getStore()?.correlationId;
  }
}

