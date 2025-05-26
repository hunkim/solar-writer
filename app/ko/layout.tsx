import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import '../globals.css'

export default async function KoLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Explicitly get Korean messages
  const messages = await getMessages({locale: 'ko'});

  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages} locale="ko">
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
} 