import { GeoSurgeService } from './geo-surge.service';
export declare class GeoSurgeController {
    private readonly geoSurgeService;
    constructor(geoSurgeService: GeoSurgeService);
    getStatus(): Promise<{
        ok: boolean;
        zones: never[];
        message: string;
    }>;
    recalc(): Promise<{
        ok: boolean;
        method: string;
        result: any;
        error?: undefined;
        reason?: undefined;
    } | {
        ok: boolean;
        method: string;
        error: any;
        result?: undefined;
        reason?: undefined;
    } | {
        ok: boolean;
        reason: string;
        method?: undefined;
        result?: undefined;
        error?: undefined;
    }>;
}
