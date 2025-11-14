'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../store/useAppStore';

const HomePage: React.FC = () => {
  const router = useRouter();
  const { isConnected } = useAppStore();

  const handleGetStarted = () => {
    if (isConnected) {
      router.push('/chat');
    } else {
      router.push('/connect');
    }
  };

  return (
    <div className="landing-container">
      <div className="landing-content">
        <div className="landing-card">
          <div className="landing-logo">
            <h1>Web3 Messenger</h1>
            <p>Decentralized messaging powered by XMTP</p>
          </div>

          <div className="landing-features">
            <div className="feature-item">
              <div className="feature-icon">🔐</div>
              <div className="feature-text">
                <h3>Secure & Private</h3>
                <p>End-to-end encrypted messages on the blockchain</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">💬</div>
              <div className="feature-text">
                <h3>Real-time Chat</h3>
                <p>Instant messaging with Web3 wallet addresses</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🌐</div>
              <div className="feature-text">
                <h3>Decentralized</h3>
                <p>No central server, your data stays with you</p>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleGetStarted}>
            Get Started
          </button>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Connect your wallet to start messaging
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;

