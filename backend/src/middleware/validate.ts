/**
 * Zod request validation middleware factory.
 *
 * Usage:
 *   import { validate } from '../middleware/validate';
 *   import { SignupSchema } from '../schemas/auth.schemas';
 *
 *   router.post('/signup', validate(SignupSchema), handler);
 *
 * On success: `req.body` is replaced with the Zod-parsed (coerced + stripped) data.
 * On failure: returns HTTP 400 with flattened Zod error details.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const formatted = (result.error as ZodError).flatten();
      res.status(400).json({
        error: 'Validation failed',
        details: formatted.fieldErrors,
      });
      return;
    }

    // Replace req.body with the coerced/stripped data from Zod
    req.body = result.data;
    next();
  };
}

/**
 * Zod query-parameter validation middleware factory.
 *
 * Usage:
 *   import { validateQuery } from '../middleware/validate';
 *   import { BooksQuerySchema } from '../schemas/content.schemas';
 *
 *   router.get('/', validateQuery(BooksQuerySchema), handler);
 *
 * On success: `req.query` values are coerced (strings → numbers etc.).
 * On failure: returns HTTP 400 with flattened Zod error details.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const formatted = (result.error as ZodError).flatten();
      res.status(400).json({
        error: 'Invalid query parameters',
        details: formatted.fieldErrors,
      });
      return;
    }

    // Attach coerced query values so handlers can read typed data
    (req as any).validatedQuery = result.data;
    next();
  };
}
