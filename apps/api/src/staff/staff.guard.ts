import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { satisfies } from '@rengarenk/shared';
import { STAFF_ACCESS, type StaffAccess } from './permissions.js';
import { StaffAuthService, type StaffContext } from './staff-auth.service.js';

export type StaffRequest = { headers: Record<string, string | undefined>; staff: StaffContext; ip: string };

/**
 * Yönetim uç noktalarının koruyucusu (Karar 40, Teknik tasarım §11): oturumu doğrular ve uç noktanın
 * istediği izni çalışanın yetkileriyle karşılaştırır. İzin işareti olmayan uç nokta kapalıdır.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: StaffAuthService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const access = this.reflector.getAllAndOverride<StaffAccess | undefined>(STAFF_ACCESS, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!access) throw new InternalServerErrorException('Bu uç nokta için izin tanımlanmamış');
    if (access.kind === 'public') return true;

    const req = ctx.switchToHttp().getRequest<StaffRequest>();
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) throw new UnauthorizedException();
    req.staff = await this.auth.authenticate(h.slice(7));

    if (access.kind === 'permission' && !satisfies(req.staff.grants[access.permission], access.level)) {
      throw new ForbiddenException('Bu işlem için yetkin yok');
    }
    return true;
  }
}
