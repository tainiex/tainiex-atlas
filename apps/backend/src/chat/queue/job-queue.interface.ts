export interface IJobQueue<T> {
  add(job: T): Promise<void>;
  process(handler: (job: T) => Promise<void>): void;
  onModuleDestroy(): void;
}
