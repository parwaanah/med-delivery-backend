import { RidersService } from './riders.service';
import { CreateRiderDto, UpdateRiderDto, UpdateStatusDto } from './dto/rider.dto';
import { SurgeService } from '../surge/surge.service';
export declare class RidersController {
    private readonly ridersService;
    private readonly surge;
    constructor(ridersService: RidersService, surge: SurgeService);
    findAll(): Promise<{
        name: string;
        email: string;
        createdAt: Date;
        id: number;
    }[]>;
    findOne(id: string): Promise<{
        name: string;
        email: string;
        createdAt: Date;
        id: number;
    }>;
    create(dto: CreateRiderDto): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    update(id: string, dto: UpdateRiderDto): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
    updateStatus(id: string, dto: UpdateStatusDto): Promise<{
        name: string;
        email: string;
        status: string;
        id: number;
    }>;
}
