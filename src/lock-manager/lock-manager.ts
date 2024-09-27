import { Injectable } from '@nestjs/common';

@Injectable()
export class LockManager {
  private locks: Record<number, Promise<any>[]> = {};

  async doWithLock<T>(lockNumber: number, task: () => Promise<T>): Promise<T> {
    if (!this.locks[lockNumber]) {
      this.locks[lockNumber] = [];
    }

    const isFirst = this.locks[lockNumber].length === 0;
    const waitingTasks = this.locks[lockNumber];

    let unlock = () => {};
    const taskLock = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    waitingTasks.push(taskLock);

    if (!isFirst) {
      await waitingTasks.at(-2);
    }

    try {
      return await task();
    } catch (e) {
      throw e;
    } finally {
      // 이 시점에서 현재 task 의 인덱스는 0이다.
      waitingTasks.splice(0, 1);
      unlock();
    }
  }
}
