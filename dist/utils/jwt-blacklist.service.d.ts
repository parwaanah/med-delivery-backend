export declare class JwtBlacklistService {
    private redis;
    private prefix;
    revoke(token: string, exp: number): Promise<void>;
    isRevoked(token: string): Promise<boolean>;
}
