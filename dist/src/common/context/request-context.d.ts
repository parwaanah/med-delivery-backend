interface RequestStore {
    requestId: string;
    userId?: string;
    userRole?: string;
}
export declare class RequestContext {
    static run(fn: (...args: any[]) => void, store?: Partial<RequestStore>): void;
    static get<T extends keyof RequestStore>(key: T): RequestStore[T] | undefined;
    static getRequestId(): string;
    static getUser(): {
        id: string;
        role: string;
    };
}
export {};
