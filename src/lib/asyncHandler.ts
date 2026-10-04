import type { NextFunction, Request, Response } from "express";

/**
 * async なルートハンドラの例外を Express のエラーハンドラに渡すためのラッパ。
 * これがないと async 関数内の throw が未処理になる。
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
