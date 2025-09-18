"use client";

import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import heDictionary from "../locales/he.json";
import enDictionary from "../locales/en.json";

type SupportedLocale = "he" | "en";

type TranslationParams = Record<string, string | number>;

type HomeworkI18nContextValue = {
  locale: SupportedLocale;
  direction: "rtl" | "ltr";
  t: (key: string, params?: TranslationParams, fallback?: string) => string;
  formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const dictionaries: Record<SupportedLocale, Record<string, string>> = {
  he: heDictionary,
  en: enDictionary,
};

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
};

const LocaleContext = createContext<HomeworkI18nContextValue | null>(null);

function resolveLocale(candidate?: string | null): SupportedLocale {
  if (!candidate) return "he";
  if (candidate.toLowerCase().startsWith("en")) return "en";
  return "he";
}

function formatTemplate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, token) => {
    const value = params[token];
    return typeof value === "number" ? String(value) : value ?? "";
  });
}

export function HomeworkLocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<SupportedLocale>(() => {
    if (typeof document !== "undefined") {
      return resolveLocale(document.documentElement.lang);
    }
    if (typeof navigator !== "undefined") {
      return resolveLocale(navigator.language);
    }
    return "he";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const detected = resolveLocale(document.documentElement.lang || navigator.language);
    setLocale(detected);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo<HomeworkI18nContextValue>(() => {
    const dictionary = dictionaries[locale] ?? dictionaries.he;
    const fallbackDictionary = dictionaries.en;
    const direction: "rtl" | "ltr" = locale === "he" ? "rtl" : "ltr";

    const translate = (key: string, params?: TranslationParams, fallback?: string) => {
      const template = dictionary[key] ?? fallbackDictionary[key] ?? fallback ?? key;
      return formatTemplate(template, params);
    };

    const formatDateTime = (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => {
      const formatter = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", options ?? DEFAULT_DATE_OPTIONS);
      const input = value instanceof Date ? value : new Date(value);
      return formatter.format(input);
    };

    const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
      const formatter = new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-US", options);
      return formatter.format(value);
    };

    return {
      locale,
      direction,
      t: translate,
      formatDateTime,
      formatNumber,
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useHomeworkLocale(): HomeworkI18nContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useHomeworkLocale must be used within HomeworkLocaleProvider");
  }
  return context;
}
