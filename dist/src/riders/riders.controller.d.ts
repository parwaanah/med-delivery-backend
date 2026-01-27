import { RidersService } from './riders.service';
export declare class RidersController {
    private riders;
    constructor(riders: RidersService);
    updateLocation(req: any, id: string, body: {
        lat: number;
        lon: number;
    }): Promise<{
        ok: boolean;
    }>;
    updateStatus(req: any, id: string, body: {
        status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
    }): Promise<{
        ok: boolean;
    }>;
}
