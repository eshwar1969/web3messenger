'use client';

import dynamic from 'next/dynamic';

const ChatPage = dynamic(() => import('../../src/pages/ChatPage'), {
  ssr: false,
  loading: () => (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      background: 'var(--background-light)',
      color: 'var(--text-primary)',
      fontSize: '1.25rem'
    }}>
      Loading...
    </div>
  )
});

export default function Chat() {
  return <ChatPage />;
}

