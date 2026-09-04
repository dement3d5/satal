import {z} from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120)
});

export const emailSignUpSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(10).max(128)
});

export const emailSignInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().default(true)
});
