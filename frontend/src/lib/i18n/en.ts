import { EN_AUTH } from "./en-auth";
import { EN_COMMON } from "./en-common";
import { EN_COURSES } from "./en-courses";
import { EN_PLANNING } from "./en-planning";
import { EN_REVIEW } from "./en-review";

/** Dictionnaire français -> anglais. Un fichier par groupe d'écrans, réunis ici. */
export const EN: Record<string, string> = { ...EN_COMMON, ...EN_AUTH, ...EN_COURSES, ...EN_REVIEW, ...EN_PLANNING };
