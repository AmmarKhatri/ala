import type { z } from "zod";

export interface ToolContract<
  I extends z.ZodRawShape,
  O extends z.ZodRawShape,
> {
  name: string;
  description: string;
  input: z.ZodObject<I>;
  output: z.ZodObject<O>;
  projectDerived: boolean;
}
