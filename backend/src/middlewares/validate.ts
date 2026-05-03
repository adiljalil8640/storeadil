import type { ZodTypeAny } from "zod";
import type { Request, Response, NextFunction } from "express";

export function validate<T extends ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error.message });
      return;
    }
    req.body = result.data;
    next();
  };
}
