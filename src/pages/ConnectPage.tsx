'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useXmtp } from '../hooks/useXmtp';
import { ProfileService } from '../services/profile.service';
import { useAppStore } from '../store/useAppStore';

const ConnectPage: React.FC = () => {
  const router = useRouter();
  const { connectWallet, isConnected, isInitializing, error } = useXmtp();
  const { updateUserProfile } = useAppStore();
  const [displayName, setDisplayName] = useState('');
  const [isSettingName, setIsSettingName] = useState(false);

  React.useEffect(() => {
    if (isConnected) {
      // Load existing profile
      ProfileService.getInstance().loadUserProfile();
      const profile = useAppStore.getState().userProfile;
      if (profile.username) {
        setDisplayName(profile.username);
      }
    }
  }, [isConnected]);

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (err) {
      console.error('Connection error:', err);
    }
  };

  const handleSetDisplayName = async () => {
    if (!displayName.trim()) {
      alert('Please enter a display name');
      return;
    }

    const validation = ProfileService.getInstance().validateUsername(displayName);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    try {
      setIsSettingName(true);
      const normalized = ProfileService.getInstance().normalizeUsername(displayName);
      updateUserProfile({ username: normalized });
      await ProfileService.getInstance().saveProfile();
      
      // Navigate to chat
      router.push('/chat');
    } catch (error) {
      console.error('Failed to save display name:', error);
      alert('Failed to save display name');
    } finally {
      setIsSettingName(false);
    }
  };

  if (isConnected) {
    return (
      <div className="wallet-connect-page">
        <div className="wallet-connect-card">
          <div className="wallet-icon">✅</div>
          <h1>Wallet Connected!</h1>
          <p>Set your display name to get started</p>
          
          <div style={{ marginTop: '2rem', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              style={{
                width: '100%',
                padding: '0.875rem',
                border: '2px solid var(--border-color)',
                borderRadius: '12px',
                fontSize: '1rem',
                marginBottom: '1rem',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSetDisplayName();
                }
              }}
            />
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleSetDisplayName}
            disabled={!displayName.trim() || isSettingName}
          >
            {isSettingName ? 'Setting up...' : 'Continue to Chat'}
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={() => router.push('/chat')}
            style={{ marginTop: '0.75rem' }}
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wallet-connect-page">
      <div className="wallet-connect-card">
        <div className="wallet-icon">🦊</div>
        <h1>Connect Your Wallet</h1>
        <p>Connect with MetaMask to start messaging on Web3</p>

        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <button 
          className="btn btn-primary" 
          onClick={handleConnect}
          disabled={isInitializing}
        >
          {isInitializing ? (
            <>
              <span className="loading-spinner" style={{ marginRight: '0.5rem' }}></span>
              Connecting...
            </>
          ) : (
            <>
              <span>🦊</span>
              Connect MetaMask
            </>
          )}
        </button>

        <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Don't have MetaMask?{' '}
          <a 
            href="https://metamask.io/download/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'var(--primary-green-dark)', textDecoration: 'none' }}
          >
            Install it here
          </a>
        </p>

        <button 
          className="btn btn-secondary" 
          onClick={() => router.push('/')}
          style={{ marginTop: '1rem' }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default ConnectPage;

