'use client';

import React from 'react';
import { useXmtp } from '../hooks/useXmtp';
import { FormatUtils } from '../utils/format';

const WalletConnect: React.FC = () => {
  const { isConnected, walletAddress, isInitializing, error, connectWallet, disconnect } = useXmtp();

  if (isConnected && walletAddress) {
    return (
      <div className="wallet-info">
        <div className="wallet-line">
          <div>
            <p><strong>🦊 Wallet:</strong> MetaMask</p>
            <p><strong>🔑 Address:</strong> <code>{FormatUtils.getInstance().formatAddress(walletAddress)}</code></p>
          </div>
          <button className="ghost-action tiny" onClick={disconnect}>
            Disconnect
          </button>
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
