export const suppressErrors = <T extends (...args: any[]) => any>(fn: T): T =>
  ((...args: Parameters<T>): ReturnType<T> | undefined => {
    try {
      return fn(...args);
    } catch (error) {
      console.error("Error suppressed:", error);
      return undefined;
    }
  }) as T;
