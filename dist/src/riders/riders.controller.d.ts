import { RidersService } from './riders.service';
import { CreateRiderDto, UpdateRiderDto, UpdateStatusDto, UpdateLocationDto } from './dto/rider.dto';
export declare class RidersController {
    private readonly ridersService;
    constructor(ridersService: RidersService);
    findAll(): Promise<{
        name: string;
        email: string;
        status: string;
        createdAt: Date;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }[]>;
    findOne(id: string): Promise<{
        name: string;
        email: string;
        status: string;
        createdAt: Date;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }>;
    create(dto: CreateRiderDto): Promise<{
        name: string;
        email: string;
        status: string;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }>;
    update(id: string, dto: UpdateRiderDto): Promise<{
        name: string;
        email: string;
        status: string;
        id: number;
        latitude: number | null;
        longitude: number | null;
    }>;
    updateStatus(id: string, dto: UpdateStatusDto): Promise<{
        name: string;
        email: string;
        status: string;
        id: number;
    }>;
    updateLocation(id: string, body: UpdateLocationDto): Promise<{
        ok: boolean;
        id: number;
        lat: number;
        lon: number;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
