import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeoSurgeLiveGateway } from '../ws/geo-surge-live.gateway';
export interface GeoZone {
    id: string;
    lon: number;
    lat: number;
    count: number;
    multiplier: number;
    lastUpdated: number;
}
export interface GeoPoint {
    memberId: string;
    lon: number;
    lat: number;
    distKm?: number;
    meta?: {
        [k: string]: string;
    };
}
export declare class GeoSurgeService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly gateway;
    private readonly logger;
    private redis;
    private readonly key;
    private readonly calcIntervalMs;
    private interval?;
    constructor(config: ConfigService, gateway: GeoSurgeLiveGateway);
    onModuleInit(): void;
    onModuleDestroy(): void;
    addPoint(memberId: string, lon: number, lat: number): Promise<void>;
    removePoint(memberId: string): Promise<void>;
    findNearbyPoints(lon: number, lat: number, radiusKm?: number, withMeta?: boolean, limit?: number): Promise<GeoPoint[]>;
    recalcAndBroadcast(): Promise<GeoZone[]>;
}
