import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";

@Injectable()
export class ApprovalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) return false;

    // Customers always allowed
    if (user.role === UserRole.CUSTOMER) return true;

    // Admins always allowed
    if (user.role === UserRole.ADMIN) return true;

    // Pharmacy / Rider must be approved
    if (user.status !== "APPROVED") {
      throw new ForbiddenException("Account pending admin approval");
    }

    return true;
  }
}
