import { OrderStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../utils/prisma.service';
import { LockService } from '../utils/lock.service';
type Actor = {
    id: number;
    role: UserRole;
};
type TransitionInput = {
    orderId: number;
    actor: Actor;
    to: OrderStatus;
    event: string;
    data?: any;
    from?: OrderStatus;
    extraUpdate?: Record<string, any>;
    db?: Prisma.TransactionClient;
};
export declare class OrderLifecycleService {
    private readonly prisma;
    private readonly lock;
    private readonly logger;
    constructor(prisma: PrismaService, lock: LockService);
    private normalizeStatus;
    private isTerminal;
    private canTransition;
    private logTimeline;
    transition(input: TransitionInput): Promise<{
        order: any;
        changed: boolean;
    }>;
    forceStatus(input: Omit<TransitionInput, 'from'> & {
        from?: OrderStatus;
    }): Promise<{
        order: any;
        changed: boolean;
    }>;
}
export {};
