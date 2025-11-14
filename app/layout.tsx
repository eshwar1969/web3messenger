// app/layout.tsx
'use client';

import { ReactNode } from 'react';
import '../styles/messenger.css';

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>XMTP V3 Demo</title>
        <meta name="description" content="XMTP V3 messaging demo with Web3" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
