import type { Library } from "./types";
import { mergeAfterPull } from "./library-merge";

type Dependencies = {
  current: () => Library;
  apply: (library: Library) => void;
  pull: (account: string, library: Library) => Promise<Library>;
  push: (
    account: string,
    library: Library,
    active: () => boolean,
  ) => Promise<void>;
};
type Operation = {
  account: string;
  generation: number;
  pull: boolean;
  promise: Promise<void>;
};

/** Serializes a device's writes and invalidates all completions on account changes. */
export class SyncCoordinator {
  private generation = 0;
  private account: string | null = null;
  private operation: Operation | null = null;
  constructor(private dependencies: Dependencies) {}

  activate(account: string | null) {
    this.generation++;
    this.account = account;
    this.operation = null;
  }

  run(pull = true): Promise<void> {
    if (!this.account || this.account === "local") return Promise.resolve();
    if (this.operation) {
      this.operation.pull ||= pull;
      return this.operation.promise;
    }
    const operation: Operation = {
      account: this.account,
      generation: this.generation,
      pull,
      promise: Promise.resolve(),
    };
    const active = () =>
      this.generation === operation.generation &&
      this.account === operation.account;
    this.operation = operation;
    operation.promise = (async () => {
      try {
        while (active()) {
          if (operation.pull) {
            operation.pull = false;
            const base = this.dependencies.current();
            const remote = await this.dependencies.pull(
              operation.account,
              base,
            );
            if (!active()) return;
            this.dependencies.apply(
              mergeAfterPull(base, this.dependencies.current(), remote),
            );
          }
          const snapshot = this.dependencies.current();
          await this.dependencies.push(operation.account, snapshot, active);
          if (
            !active() ||
            (snapshot === this.dependencies.current() && !operation.pull)
          )
            return;
          // Edits during a write are sent next; a busy sync never drops a checkpoint.
        }
      } catch (error) {
        if (active()) throw error;
      } finally {
        if (this.operation === operation) this.operation = null;
      }
    })();
    return operation.promise;
  }
}
