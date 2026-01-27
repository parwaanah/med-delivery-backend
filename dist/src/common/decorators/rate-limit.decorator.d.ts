export declare const RATE_LIMIT_META_KEY = "rate_limit";
export type RateLimitOptions = {
    key: string;
    limit: number;
    windowMs: number;
};
export declare const RateLimit: (opts: RateLimitOptions) => import("@nestjs/common").CustomDecorator<string>;
