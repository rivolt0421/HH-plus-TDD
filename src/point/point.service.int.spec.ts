import { Test, TestingModule } from '@nestjs/testing';
import { PointService } from './point.service';
import { UserPointRepositoryToken } from './user-point.repository';
import { PointHistoryRepositoryToken } from './point-history.repository';
import { LockManager } from '../lock-manager/lock-manager';
import { UserPoint, PointHistory, TransactionType } from './point.model';
import { setTimeout } from 'timers/promises';

describe('PointService 동시성 테스트', () => {
  let pointService: PointService;
  let userPointRepository: UserPointRepositoryStub;
  let pointHistoryRepository: PointHistoryRepositoryStub;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointService,
        LockManager,
        {
          provide: UserPointRepositoryToken,
          useClass: UserPointRepositoryStub,
        },
        {
          provide: PointHistoryRepositoryToken,
          useClass: PointHistoryRepositoryStub,
        },
      ],
    }).compile();

    pointService = module.get<PointService>(PointService);
    userPointRepository = module.get(UserPointRepositoryToken);
    pointHistoryRepository = module.get(PointHistoryRepositoryToken);
  });

  test('같은 사용자의 충전과 사용 요청이 동시에 들어와도 순차적으로 처리된다', async () => {
    const userId = 1;
    await userPointRepository.upsertUserPoint({
      id: userId,
      point: 500,
      updateMillis: Date.now(),
    });

    await Promise.all([
      pointService.chargePoint(userId, 200),
      pointService.usePoint(userId, 100),
      pointService.chargePoint(userId, 300),
      pointService.usePoint(userId, 200),
    ]);

    // 최종 포인트 확인
    const finalUserPoint = await userPointRepository.findUserPointById(userId);
    expect(finalUserPoint.point).toBe(700); // 500 + 200 - 100 + 300 - 200 = 700

    // 포인트 히스토리 확인
    const expectedHistories = [
      { amount: 200, type: TransactionType.CHARGE },
      { amount: 100, type: TransactionType.USE },
      { amount: 300, type: TransactionType.CHARGE },
      { amount: 200, type: TransactionType.USE },
    ];

    const histories =
      await pointHistoryRepository.findPointHistoriesByUserId(userId);
    histories.sort((a, b) => a.timeMillis - b.timeMillis);

    expect(histories).toHaveLength(4);

    histories.forEach((history, index) => {
      expect(history.amount).toBe(expectedHistories[index].amount);
      expect(history.type).toBe(expectedHistories[index].type);
    });
  });

  test('서로 다른 유저의 요청은 독립적으로 처리된다', async () => {
    const user1Id = 1;
    const user2Id = 2;
    await userPointRepository.upsertUserPoint({
      id: user1Id,
      point: 0,
      updateMillis: Date.now(),
    });
    await userPointRepository.upsertUserPoint({
      id: user2Id,
      point: 100,
      updateMillis: Date.now(),
    });

    const originalUpsertUserPoint = userPointRepository.upsertUserPoint;
    jest
      .spyOn(userPointRepository, 'upsertUserPoint')
      .mockImplementation(async (userPoint: UserPoint) => {
        if (userPoint.id === user2Id) {
          await setTimeout(500); // 0.5초 지연
        }
        return originalUpsertUserPoint.call(userPointRepository, userPoint);
      });

    await Promise.all([
      pointService.chargePoint(user1Id, 1),
      pointService.chargePoint(user2Id, 500), // 2
      pointService.chargePoint(user1Id, 1),
      pointService.chargePoint(user1Id, 1),
      pointService.chargePoint(user1Id, 1),
      pointService.chargePoint(user1Id, 1),
      pointService.usePoint(user1Id, 5),
      pointService.chargePoint(user2Id, 200), // 2
    ]);

    // 각 사용자의 최종 포인트 확인
    const finalUser1Point =
      await userPointRepository.findUserPointById(user1Id);
    const finalUser2Point =
      await userPointRepository.findUserPointById(user2Id);

    expect(finalUser1Point.point).toBe(0); // 0 + 1 + 1 + 1 + 1 + 1 - 5
    expect(finalUser2Point.point).toBe(800); // 100 + 500

    // 포인트 히스토리 확인
    const expectedHistoriesUser1 = [
      { amount: 1, type: TransactionType.CHARGE },
      { amount: 1, type: TransactionType.CHARGE },
      { amount: 1, type: TransactionType.CHARGE },
      { amount: 1, type: TransactionType.CHARGE },
      { amount: 1, type: TransactionType.CHARGE },
      { amount: 5, type: TransactionType.USE },
    ];
    const expectedHistoriesUser2 = [
      { amount: 500, type: TransactionType.CHARGE },
      { amount: 200, type: TransactionType.CHARGE },
    ];

    const user1Histories =
      await pointHistoryRepository.findPointHistoriesByUserId(user1Id);
    const user2Histories =
      await pointHistoryRepository.findPointHistoriesByUserId(user2Id);
    user1Histories.sort((a, b) => a.timeMillis - b.timeMillis);
    user2Histories.sort((a, b) => a.timeMillis - b.timeMillis);

    expect(user1Histories).toHaveLength(6);
    expect(user2Histories).toHaveLength(2);

    user1Histories.forEach((history, index) => {
      expect(history.amount).toBe(expectedHistoriesUser1[index].amount);
      expect(history.type).toBe(expectedHistoriesUser1[index].type);
    });
    user2Histories.forEach((history, index) => {
      expect(history.amount).toBe(expectedHistoriesUser2[index].amount);
      expect(history.type).toBe(expectedHistoriesUser2[index].type);
    });

    // user1의 두 번째 요청이 user2의 긴 요청보다 먼저 완료되었는지 확인
    const user1SecondOperationTime = user1Histories[1].timeMillis;
    const user2OperationTime = user2Histories[0].timeMillis;

    expect(user1SecondOperationTime).toBeLessThan(user2OperationTime);

    jest.restoreAllMocks();
  });
});

class UserPointRepositoryStub {
  private userPoints: Map<number, UserPoint> = new Map();

  async findUserPointById(id: number): Promise<UserPoint | null> {
    return this.userPoints.get(id) ?? null;
  }

  async upsertUserPoint(userPoint: UserPoint): Promise<UserPoint> {
    await setTimeout(Math.random() * 100);

    const updatedPoint = { ...userPoint, updateMillis: Date.now() };
    this.userPoints.set(userPoint.id, updatedPoint);

    return updatedPoint;
  }
}
class PointHistoryRepositoryStub {
  private histories: PointHistory[] = [];

  async saveHistory(history: Omit<PointHistory, 'id'>): Promise<PointHistory> {
    const newHistory = { ...history, id: this.histories.length + 1 };
    this.histories.push(newHistory);
    return newHistory;
  }

  async findPointHistoriesByUserId(userId: number): Promise<PointHistory[]> {
    return this.histories.filter((h) => h.userId === userId);
  }
}
