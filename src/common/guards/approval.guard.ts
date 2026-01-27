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

    const rawPath: string = req.originalUrl || req.url || "";
    const path = rawPath.split("?")[0];

    // Allow auth bootstrap for any logged-in user
    if (path === "/users/me") return true;

    // Suspended pharmacy: block everything except /auth/* and /users/me
    if (user.role === UserRole.PHARMACY && user.status === "SUSPENDED") {
      if (path.startsWith("/auth/") || path === "/users/me") return true;
      throw new ForbiddenException("Account suspended. Contact support.");
    }

    // Pharmacy can access limited endpoints before approval
    if (user.role === UserRole.PHARMACY && user.status !== "APPROVED") {
      const allowed =
        path.startsWith("/auth/") ||
        path === "/users/me" ||
        path === "/profile/me" ||
        path === "/profile/documents" ||
        path === "/profile/status";

      if (!allowed) {
        throw new ForbiddenException("Account pending admin approval");
      }

      return true;
    }

    // Rider control plane:
    // - Only ACTIVE riders can use most APIs
    // - Allow limited endpoints for OFFLINE/PENDING (notifications + docs + lifecycle toggle)
    if (user.role === UserRole.RIDER) {
      const allowed =
        path.startsWith("/auth/") ||
        path === "/users/me" ||
        path.startsWith("/notifications") ||
        path.startsWith("/rider/profile/documents") ||
        path === "/rider/lifecycle";

      if (user.status === "SUSPENDED") {
        if (allowed) return true;
        throw new ForbiddenException("Account suspended. Contact support.");
      }

      if (user.status !== "ACTIVE") {
        if (allowed) return true;
        throw new ForbiddenException("Access denied: rider must be ACTIVE");
      }

      return true;
    }

    return true;
  }
}
