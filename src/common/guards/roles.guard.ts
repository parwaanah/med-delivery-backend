// src/common/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Allow access if no roles required
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role)
      throw new ForbiddenException('User role missing in token');

    const userRole = String(user.role).toLowerCase();
    const normalizedRequired = requiredRoles.map((role) =>
      String(role).toLowerCase(),
    );

    // Treat SUPERADMIN as ADMIN for role checks.
    const effectiveRole = userRole === 'superadmin' ? 'admin' : userRole;

    const allowed = normalizedRequired.some((role) => role === effectiveRole);

    if (!allowed) {
      throw new ForbiddenException(
        `Access denied: requires [${requiredRoles}], got "${user.role}"`
      );
    }

    return true;
  }
}
