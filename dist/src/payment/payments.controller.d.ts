import { PaymentsService } from './payments.service';
import { Request } from 'express';
export declare class PaymentsController {
    private paymentsService;
    constructor(paymentsService: PaymentsService);
    handleWebhook(req: Request & {
        rawBody?: Buffer;
    }, signature: string): Promise<{
        received: boolean;
    }>;
    createIntent(amount: number, userId: number): Promise<{
        clientSecret: string | null;
        id: string;
        amount: number;
    }>;
}
