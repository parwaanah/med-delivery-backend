import { RedisService } from '../utils/redis.service';
export declare class RazorpayService {
    private readonly redis;
    private readonly logger;
    private readonly client?;
    private readonly enabled;
    constructor(redis: RedisService);
    createOrder(amountInPaise: number, currency?: string, receipt?: string): Promise<any>;
    verifyWebhookSignature(rawBody: Buffer, signature: string, secret?: string): boolean;
    refundPayment(paymentId: string, amountInPaise?: number): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund | {
        mock: boolean;
        refunded: boolean;
    }>;
    private key;
    private beforeCall;
    private onSuccess;
    private onFailure;
}
