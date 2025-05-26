import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import '../globals.css'

export default async function JaLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Explicitly get Japanese messages
  const messages = await getMessages({locale: 'ja'});

  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages} locale="ja">
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
} 