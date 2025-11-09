import { PrismaService } from '../utils/prisma.service';
export declare class ReportsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    generateDailyReport(): Promise<{
        json: string;
        pdf: string;
    }>;
}
