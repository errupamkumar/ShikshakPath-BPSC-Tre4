import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { isLang, LANG_COOKIE, makeT, type Lang, type TFn } from "./i18n";

/** The visitor's language from the "lang" cookie (default English). Cached per request. */
export const getLang = cache(async (): Promise<Lang> => {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
});

export async function getT(): Promise<{ lang: Lang; t: TFn }> {
  const lang = await getLang();
  return { lang, t: makeT(lang) };
}
