import { CanActivate, ExecutionContext } from "@nestjs/common";
export declare class ApprovalGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
