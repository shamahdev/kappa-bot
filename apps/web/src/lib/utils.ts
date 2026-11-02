import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn's class combiner: conditional classes, de-duplicated. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
