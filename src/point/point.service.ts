import { Injectable, Inject } from '@nestjs/common';
import { PointHistory, TransactionType, UserPoint } from './point.model';
import {
  UserPointRepository,
  UserPointRepositoryToken,
} from './user-point.repository';
import {
  PointHistoryRepository,
  PointHistoryRepositoryToken,
} from './point-history.repository';

@Injectable()
export class PointService {
  constructor(
    @Inject(UserPointRepositoryToken)
    private userPointRepository: UserPointRepository,
    @Inject(PointHistoryRepositoryToken)
    private pointHistoryRepository: PointHistoryRepository,
  ) {}

  async getUserPoint(userId: number): Promise<UserPoint> {
    const userPoint = await this.userPointRepository.findUserPointById(userId);

    if (!userPoint) {
      return this.getInitialUserPoint(userId);
    }

    return userPoint;
  }

  async getPointHistories(userId: number): Promise<PointHistory[]> {
    return this.pointHistoryRepository.findPointHistoriesByUserId(userId);
  }

  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    const userPoint =
      (await this.userPointRepository.findUserPointById(userId)) ??
      this.getInitialUserPoint(userId);

    userPoint.point += amount;

    const updatedUserPoint =
      await this.userPointRepository.upsertUserPoint(userPoint);

    await this.pointHistoryRepository.saveHistory({
      userId,
      amount,
      type: TransactionType.CHARGE,
      timeMillis: Date.now(),
    });

    return updatedUserPoint;
  }

  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    const userPoint =
      (await this.userPointRepository.findUserPointById(userId)) ??
      this.getInitialUserPoint(userId);

    if (userPoint.point < amount) {
      throw Error('포인트 잔액이 부족합니다.');
    }

    userPoint.point -= amount;

    const updatedUserPoint =
      await this.userPointRepository.upsertUserPoint(userPoint);

    await this.pointHistoryRepository.saveHistory({
      userId,
      amount,
      type: TransactionType.USE,
      timeMillis: Date.now(),
    });

    return updatedUserPoint;
  }

  private getInitialUserPoint(userId: number) {
    return { id: userId, point: 0, updateMillis: Date.now() };
  }
}
