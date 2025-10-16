import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

interface RequestStore {
  requestId: string;
  userId?: string;
  userRole?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestStore>();

export class RequestContext {
  static run(fn: (...args: any[]) => void, store: Partial<RequestStore> = {}) {
    const context = {
      requestId: store.requestId ?? randomUUID(),
      userId: store.userId ?? '-',
      userRole: store.userRole ?? '-',
    };
    asyncLocalStorage.run(context, fn);
  }

  static get<T extends keyof RequestStore>(key: T): RequestStore[T] | undefined {
    const store = asyncLocalStorage.getStore();
    return store ? store[key] : undefined;
  }

  static getRequestId(): string {
    return this.get('requestId') || 'no-req-id';
  }

  static getUser(): { id: string; role: string } {
    const userId = this.get('userId') || '-';
    const userRole = this.get('userRole') || '-';
    return { id: userId, role: userRole };
  }
}
