export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export function actionSuccess<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function actionError(message: string): ActionResult<never> {
  return { success: false, error: message };
}
