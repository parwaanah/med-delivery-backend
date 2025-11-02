import { RidersService } from './riders.service';
import { CreateRiderDto, UpdateRiderDto, UpdateStatusDto } from './dto/rider.dto';
export declare class RidersController {
    private readonly ridersService;
    constructor(ridersService: RidersService);
    findAll(): Promise<{
        name: string;
        email: string;
        id: number;
        createdAt: Date;
    }[]>;
    findOne(id: string): Promise<{
        name: string;
        email: string;
        id: number;
        createdAt: Date;
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
        id: number;
        status: string | null;
    }>;
}
