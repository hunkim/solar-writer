import {notFound} from 'next/navigation';
import {getRequestConfig} from 'next-intl/server';

// Can be imported from a shared config
export const locales = ['en', 'ko', 'ja'] as const;
export const defaultLocale = 'en' as const;

export type Locale = typeof locales[number];

export default getRequestConfig(async ({locale}) => {
  // If locale is not provided, try to detect it from the URL
  let actualLocale = locale;
  
  if (!actualLocale) {
    // This is a fallback - in practice, this shouldn't happen with proper routing
    actualLocale = defaultLocale;
  }
  
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(actualLocale as any)) {
    actualLocale = defaultLocale;
  }

  return {
    locale: actualLocale,
    messages: (await import(`./messages/${actualLocale}.json`)).default
  };
}); 