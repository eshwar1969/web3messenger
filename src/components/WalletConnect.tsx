'use client';

import React, { useState } from 'react';
import { useXmtp } from '../hooks/useXmtp';
import { useAppStore } from '../store/useAppStore';
import { FormatUtils } from '../utils/format';

const WalletConnect: React.FC = () => {
  const { isConnected, walletAddress, isInitializing, error, connectWallet, disconnect } = useXmtp();
  const { xmtpClient } = useAppStore();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  if (isConnected && walletAddress) {
    return (
      <div className="profile-display">
        <div className="profile-header">
          <h3>🦊 Your Profile</h3>
          <button className="ghost-action tiny" onClick={disconnect}>
            Disconnect
          </button>
        </div>
        
        <div className="profile-details">
          {/* Wallet Address */}
          <div className="profile-item">
            <label>Wallet Address:</label>
            <div className="profile-value-row">
              <code className="profile-value">
                {FormatUtils.getInstance().formatAddress(walletAddress)}
              </code>
              <button
                className="copy-btn"
                onClick={() => copyToClipboard(walletAddress, 'wallet')}
                title="Copy full wallet address"
              >
                {copiedField === 'wallet' ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
            <small className="profile-hint">Full: {walletAddress}</small>
          </div>

          {/* Inbox ID */}
          {xmtpClient && xmtpClient.inboxId && (
            <div className="profile-item">
              <label>Inbox ID:</label>
              <div className="profile-value-row">
                <code className="profile-value">
                  {FormatUtils.getInstance().formatInboxId(xmtpClient.inboxId)}
                </code>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(xmtpClient.inboxId || '', 'inbox')}
                  title="Copy full inbox ID"
                >
                  {copiedField === 'inbox' ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
              <small className="profile-hint">Full: {xmtpClient.inboxId}</small>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="wallet-connect">
        <button className="primary-action" disabled>
          🦊 Connecting...
        </button>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button className="primary-action" onClick={connectWallet}>
        🦊 Connect MetaMask
      </button>
      {error && (
        <div className="error-message">
          <p>❌ {error}</p>
        </div>
      )}
      <div className="wallet-hint">
        <p>Don't have MetaMask? <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">Install it here</a></p>
      </div>
    </div>
  );
};

export default WalletConnect;
