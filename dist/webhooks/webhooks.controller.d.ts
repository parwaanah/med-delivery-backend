import { WebhooksService } from './webhooks.service';
export declare class WebhooksController {
    private readonly service;
    constructor(service: WebhooksService);
    pharmacyCallback(key: string, payload: any): Promise<{
        ok: boolean;
    }>;
    riderCallback(key: string, payload: any): Promise<{
        ok: boolean;
    }>;
}
