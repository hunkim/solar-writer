import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import '../globals.css'

export default async function EnLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // Explicitly get English messages  
  const messages = await getMessages({locale: 'en'});

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages} locale="en">
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
} 