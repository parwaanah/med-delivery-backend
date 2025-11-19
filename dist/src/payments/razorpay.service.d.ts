import Razorpay from 'razorpay';
export declare class RazorpayService {
    private readonly logger;
    readonly client: Razorpay;
    constructor();
    createOrder(amountInPaise: number, currency?: string, receipt?: string): Promise<any>;
    verifyWebhookSignature(rawBody: Buffer, signature: string, secret?: string): boolean;
    refundPayment(paymentId: string, amountInPaise?: number): Promise<import("razorpay/dist/types/refunds").Refunds.RazorpayRefund>;
}
