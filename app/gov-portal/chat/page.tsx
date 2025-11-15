'use client';

import dynamic from 'next/dynamic';

const GovChatPage = dynamic(() => import('../../../src/pages/GovChatPage'), {
  ssr: false,
  loading: () => (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      background: 'var(--gradient-background)',
      color: 'white',
      fontSize: '1.25rem'
    }}>
      Loading Secure Chat...
    </div>
  )
});

export default function GovChat() {
  return <GovChatPage />;
}

