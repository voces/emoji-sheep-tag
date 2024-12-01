export class UnknownEntity extends Error {
  constructor(readonly entityId: string) {
    super(`Could not find entity ${entityId}`);
  }
}
