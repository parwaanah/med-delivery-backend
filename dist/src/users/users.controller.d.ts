import { UsersService } from './users.service';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(req: any): Promise<{
        id: number;
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        preferredPharmacyId: number | null;
        refreshToken: string | null;
    }[]>;
    findOne(req: any, id: string): Promise<{
        id: number;
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        preferredPharmacyId: number | null;
        refreshToken: string | null;
    } | null>;
    create(body: {
        name: string;
        email: string;
        password: string;
    }): Promise<{
        id: number;
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        preferredPharmacyId: number | null;
        refreshToken: string | null;
    }>;
    update(req: any, id: string, body: {
        name?: string;
        email?: string;
        password?: string;
    }): Promise<{
        id: number;
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        preferredPharmacyId: number | null;
        refreshToken: string | null;
    }>;
    remove(req: any, id: string): Promise<{
        id: number;
        name: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        createdAt: Date;
        preferredPharmacyId: number | null;
        refreshToken: string | null;
    }>;
}
