'use client';

// app/page.tsx
import dynamic from 'next/dynamic';

const App = dynamic(() => import('../src/app/chat/App'), {
  ssr: false,
  loading: () => <div>Loading...</div>
});

export default function Home() {
  return <App />;
}
