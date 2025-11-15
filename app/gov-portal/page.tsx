'use client';

import dynamic from 'next/dynamic';

const GovPortalPage = dynamic(() => import('../../src/pages/GovPortalPage'), {
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
      Loading Secure Portal...
    </div>
  )
});

export default function GovPortal() {
  return <GovPortalPage />;
}

