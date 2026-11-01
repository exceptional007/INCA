import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { SchedulesController } from '../../modules/scheduling/schedules/schedules.controller';

describe('schedule generation permissions', () => {
  const guard = new RolesGuard(new Reflector());
  const contextFor = (user: unknown) => ({
    getHandler: () => SchedulesController.prototype.generate,
    getClass: () => SchedulesController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as ExecutionContext;

  it.each(['ADMIN', { code: 'ADMIN', name: 'Admin' }])(
    'allows an authenticated admin with role %p', (role) => {
      expect(guard.canActivate(contextFor({ role }))).toBe(true);
    },
  );

  it.each(['FACULTY', 'STUDENT', { code: 'FACULTY' }, {}, undefined])(
    'rejects unauthorized or missing role %p', (role) => {
      expect(() => guard.canActivate(contextFor({ role }))).toThrow(ForbiddenException);
    },
  );

  it('rejects requests without an authenticated user', () => {
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
