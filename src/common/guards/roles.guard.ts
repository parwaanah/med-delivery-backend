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

    // Allow access if no roles are required
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException('User role not found in token');
    }

    // ✅ Normalize both sides to lowercase for case-insensitive matching
    const userRole = String(user.role).toLowerCase();
    const allowed = requiredRoles.some(
      (role) => role.toLowerCase() === userRole,
    );

    if (!allowed) {
      throw new ForbiddenException(
        `Access denied: requires one of [${requiredRoles.join(', ')}], but user has role "${user.role}"`,
      );
    }

    return true;
  }
}
