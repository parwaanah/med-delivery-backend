import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }[]>;
    findOne(id: string): Promise<{
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: number;
        status: string | null;
        latitude: number | null;
        longitude: number | null;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
    }>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
