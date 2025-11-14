'use client';

import React, { useEffect } from 'react';
import { useXmtp } from '../../hooks/useXmtp';
import { useConversations } from '../../hooks/useConversations';
import WalletConnect from '../../components/WalletConnect';
import ConversationList from '../../components/ConversationList';
import ChatWindow from '../../components/ChatWindow';
import ProfileSetup from '../../components/ProfileSetup';
import LandingProfileSetup from '../../components/LandingProfileSetup';
import WalletInfo from '../../components/WalletInfo';
import FriendDirectory from '../../components/FriendDirectory';
import StartDM from '../../components/StartDM';
import CreateRoom from '../../components/CreateRoom';
import JoinRoom from '../../components/JoinRoom';
import ActivityLogs from '../../components/ActivityLogs';
import { ProfileService } from '../../services/profile.service';

const App: React.FC = () => {
  const { isConnected, error } = useXmtp();
  const { conversations } = useConversations();

  // Load profile on mount
  useEffect(() => {
    ProfileService.getInstance().loadUserProfile();
    ProfileService.getInstance().loadTheme();
  }, []);

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand">
          <div className="brand-mark">XMTP</div>
          <div className="brand-copy">Messaging reinvented for Web2 UX</div>
        </div>
        <div className="nav-status">
          <ProfileSetup />
          <span className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Wallet connected' : 'Wallet disconnected'}
          </span>
        </div>
      </header>

      <main className="app-main">
        <section id="landingView" className={`landing-view ${!isConnected ? 'active' : ''}`} style={{ display: isConnected ? 'none' : 'block' }}>
          <div className="landing-card">
            <div className="landing-copy">
              <h1>Chat like Web2, secured by Web3.</h1>
              <p>Spin up decentralized conversations over XMTP V3 with a polished Web2-inspired messenger. Connect your wallet to unlock your inbox, start DMs, and sync messages in real time.</p>
              <WalletConnect />
              {!isConnected && <LandingProfileSetup />}
              <div className="landing-hint">
                Don't have MetaMask? <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">Install it here</a>.
              </div>
            </div>
            <div className="landing-preview">
              <div className="preview-card">
                <div className="preview-header">
                  <div className="preview-title">Inbox snapshot</div>
                  <div className="preview-indicator">Live</div>
                </div>
                <div className="preview-message sent">
                  <span className="bubble-title">You</span>
                  <span className="bubble-text">Ready to test the new XMTP drop?</span>
                </div>
                <div className="preview-message received">
                  <span className="bubble-title">peer.inbox</span>
                  <span className="bubble-text">Always. Sending over the inbox ID now.</span>
                </div>
                <div className="preview-message sent">
                  <span className="bubble-title">You</span>
                  <span className="bubble-text">Perfect — let's sync in the dev network.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <h3>Wallet-first onboarding</h3>
              <p>Authenticate with MetaMask and create an XMTP V3 identity in one click.</p>
            </div>
            <div className="feature-card">
              <h3>DM-ready tooling</h3>
              <p>Look up peers by Ethereum address or inbox ID, then spin up chats instantly.</p>
            </div>
            <div className="feature-card">
              <h3>Real-time streams</h3>
              <p>Conversations and messages stay fresh thanks to live XMTP streaming.</p>
            </div>
          </div>
        </section>

        {isConnected && (
          <section id="chatView" className="chat-view">
            <aside className="chat-sidebar">
              <div className="sidebar-card highlight">
                <h2>Your wallet</h2>
                <WalletInfo />
                <div className="info-box">
                  💡 XMTP V3 + MetaMask keeps your real identity under your control.
                </div>
              </div>

              <FriendDirectory />

              <CreateRoom />
              <JoinRoom />

              <div className="sidebar-card">
                <StartDM />
                <div className="card-header conversations">
                  <h2>Inbox</h2>
                  <span className="card-subtitle">Live conversations</span>
                </div>
                <ConversationList />
              </div>
            </aside>

            <section className="chat-content">
              <ChatWindow />
              <ActivityLogs />
            </section>
          </section>
        )}

        {error && (
          <div className="error-banner">
            <p>❌ {error}</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
