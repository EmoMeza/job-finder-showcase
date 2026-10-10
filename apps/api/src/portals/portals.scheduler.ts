import { Inject, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PortalsService } from './portals.service.js';

/**
 * Las sesiones de los portales vencen si no se usan (por ejemplo, a los 7 días, renovados con cada
 * uso). Una revisión diaria las mantiene vivas y detecta las que hay que reconectar.
 */
@Injectable()
export class PortalsScheduler {
  constructor(@Inject(PortalsService) private readonly portals: PortalsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  keepSessionsAlive(): Promise<void> {
    return this.portals.checkAll();
  }
}
