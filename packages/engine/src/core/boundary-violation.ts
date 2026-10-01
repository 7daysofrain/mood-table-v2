// Commit temporal (tarea 1.14 de MOO-28): rompe la regla de fronteras a propósito para comprobar
// que la CI lo rechaza. Se revierte en el commit siguiente.
import { ADAPTERS_NAME } from '../adapters/index.ts';

export const VIOLATION = ADAPTERS_NAME;
