import { Module } from '@nestjs/common';
import { LockManager } from '../lock-manager/lock-manager';
import { PointController } from './point.controller';
import { DatabaseModule } from 'src/database/database.module';
import { PointService } from './point.service';
import { UserPointRepositoryToken } from './user-point.repository';
import { PointHistoryRepositoryImpl } from 'src/database/point-history.repository.impl';
import { PointHistoryRepositoryToken } from './point-history.repository';
import { UserPointRepositoryImpl } from 'src/database/user-point.repository.impl';

@Module({
  imports: [DatabaseModule],
  providers: [
    PointService,
    LockManager,
    { provide: UserPointRepositoryToken, useClass: UserPointRepositoryImpl },
    {
      provide: PointHistoryRepositoryToken,
      useClass: PointHistoryRepositoryImpl,
    },
  ],
  controllers: [PointController],
})
export class PointModule {}
