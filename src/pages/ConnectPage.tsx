'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useXmtp } from '../hooks/useXmtp';
import { ProfileService } from '../services/profile.service';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';
import { BrowserProvider } from 'ethers';

const ConnectPage: React.FC = () => {
  const router = useRouter();
  const { connectWallet, isConnected, isInitializing, error, walletAddress } = useXmtp();
  const { updateUserProfile } = useAppStore();
  const [displayName, setDisplayName] = useState('');
  const [isSettingName, setIsSettingName] = useState(false);
  const [showRevokePanel, setShowRevokePanel] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [installations, setInstallations] = useState<any[]>([]);

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
            <div style={{ marginBottom: error.includes('installations') ? '0.75rem' : '0' }}>
              {error}
            </div>
            {error.includes('installations') && (
              <div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#991b1b', lineHeight: '1.5' }}>
                  💡 <strong>Solution:</strong> You've reached the maximum of 10 XMTP installations. To fix this:
                </div>
                <ol style={{ marginTop: '0.5rem', marginLeft: '1.5rem', fontSize: '0.75rem', color: '#991b1b', lineHeight: '1.8' }}>
                  <li>Visit <a 
                    href="https://xmtp.chat" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#dc2626', textDecoration: 'underline', fontWeight: 600 }}
                  >
                    xmtp.chat
                  </a> in a new tab</li>
                  <li>Connect with the same MetaMask wallet</li>
                  <li>Go to Settings → Installations</li>
                  <li>Revoke old/unused installations</li>
                  <li>Come back here and try connecting again</li>
                </ol>
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    onClick={() => window.open('https://xmtp.chat', '_blank')}
                    style={{
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      padding: '0.625rem 1.25rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      justifyContent: 'center'
                    }}
                  >
                    <span>🔗</span>
                    Open xmtp.chat to Manage Installations
                  </button>
                  <div style={{ fontSize: '0.7rem', color: '#991b1b', textAlign: 'center', marginTop: '0.25rem' }}>
                    ⚠️ Note: xmtp.chat may also show the same error. If so, try the solution below.
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('⚠️ WARNING: This will clear all local XMTP data (messages, conversations) stored in this browser.\n\nThis may help reuse an existing installation. Continue?')) {
                        try {
                          const { XmtpService } = await import('../services/xmtp.service');
                          await XmtpService.getInstance().clearLocalStorage();
                          alert('✅ Local storage cleared! Please refresh the page and try connecting again.');
                          window.location.reload();
                        } catch (e: any) {
                          alert('Failed to clear storage: ' + (e.message || 'Unknown error'));
                        }
                      }
                    }}
                    style={{
                      background: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      padding: '0.625rem 1.25rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      justifyContent: 'center'
                    }}
                  >
                    <span>🗑️</span>
                    Clear Local Storage (Try This If xmtp.chat Fails)
                  </button>
                  <div style={{ fontSize: '0.7rem', color: '#991b1b', textAlign: 'center', marginTop: '0.25rem' }}>
                    This clears browser storage and may allow reusing an existing installation
                  </div>
                  <button
                    onClick={async () => {
                      setShowRevokePanel(true);
                      setIsRevoking(true);
                      try {
                        // Try multiple methods to get inbox ID
                        let inboxId: string | null = null;
                        
                        // Method 1: Extract from error message
                        if (error) {
                          const inboxIdMatch = error.match(/InboxID[:\s]+([a-f0-9]{64})/i) || 
                                             error.match(/Inbox\s+ID[:\s]+([a-f0-9]{64})/i) ||
                                             error.match(/([a-f0-9]{64})/);
                          if (inboxIdMatch && inboxIdMatch[1].length === 64) {
                            inboxId = inboxIdMatch[1];
                          }
                        }
                        
                        // Method 2: Get from sessionStorage (stored by useXmtp hook)
                        if (!inboxId) {
                          inboxId = sessionStorage.getItem('xmtp_inbox_id');
                        }
                        
                        // Method 3: Try to get from wallet address (if registered)
                        if (!inboxId && walletAddress) {
                          try {
                            // This won't work if we can't create a client, but let's try
                            if (!(window as any).ethereum) {
                              throw new Error('MetaMask not detected');
                            }
                            const browserProvider = new BrowserProvider((window as any).ethereum);
                            await browserProvider.send("eth_requestAccounts", []);
                            const signer = await browserProvider.getSigner();
                            
                            // Try to create a temporary client to get inbox ID
                            // This might fail, but if it works, we can get the inbox ID
                            try {
                              const tempClient = await XmtpService.getInstance().initializeClient(signer, 'dev');
                              inboxId = tempClient.inboxId;
                            } catch (e: any) {
                              // If this fails, we'll use the error message extraction
                              console.log('Could not create temp client, will use error message extraction');
                            }
                          } catch (e) {
                            console.log('Could not get inbox ID from wallet:', e);
                          }
                        }
                        
                        if (!inboxId) {
                          const userInput = prompt(
                            'Could not automatically find your Inbox ID.\n\n' +
                            'Please enter your Inbox ID (64 character hex string):\n\n' +
                            'You can find it in the error message or from a previous XMTP connection.'
                          );
                          if (userInput && /^[a-f0-9]{64}$/i.test(userInput.trim())) {
                            inboxId = userInput.trim();
                          } else if (userInput) {
                            alert('Invalid Inbox ID format. It should be a 64 character hexadecimal string.');
                            setIsRevoking(false);
                            return;
                          } else {
                            setIsRevoking(false);
                            return;
                          }
                        }
                        
                        console.log('Using Inbox ID:', inboxId);
                        
                        // Get inbox state without creating a client
                        const inboxState = await XmtpService.getInstance().getInboxState(inboxId, 'dev');
                        
                        console.log('Inbox state:', inboxState);
                        
                        if (inboxState && inboxState.installations && inboxState.installations.length > 0) {
                          setInstallations(inboxState.installations);
                          // Store inbox ID for later use
                          sessionStorage.setItem('xmtp_inbox_id', inboxId);
                        } else {
                          alert('Could not retrieve installations. They may have already been revoked, or the Inbox ID might be incorrect.');
                        }
                      } catch (e: any) {
                        console.error('Error loading installations:', e);
                        alert('Error: ' + (e.message || 'Could not load installations') + '\n\nFull error: ' + JSON.stringify(e));
                      } finally {
                        setIsRevoking(false);
                      }
                    }}
                    style={{
                      marginTop: '0.5rem',
                      background: '#059669',
                      color: 'white',
                      border: 'none',
                      padding: '0.625rem 1.25rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      justifyContent: 'center'
                    }}
                  >
                    <span>🔧</span>
                    Revoke Installations (Recommended)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {showRevokePanel && (
          <div style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.875rem'
          }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Revoke Installations</h3>
            {isRevoking ? (
              <div>Loading installations...</div>
            ) : installations.length > 0 ? (
              <div>
                <p style={{ marginBottom: '0.75rem' }}>
                  Found {installations.length} installation(s). Select which ones to revoke:
                </p>
                {installations.map((inst: any, idx: number) => (
                  <div 
                    key={idx}
                    style={{
                      background: 'white',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        Installation {idx + 1}
                      </div>
                      {inst.bytes && (
                        <div style={{ fontSize: '0.75rem', color: '#78716c', wordBreak: 'break-all' }}>
                          ID: {Array.from(inst.bytes).slice(0, 10).map((b: number) => b.toString(16).padStart(2, '0')).join('')}...
                        </div>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm(`Revoke Installation ${idx + 1}? This will free up one installation slot.`)) {
                          return;
                        }
                        try {
                          setIsRevoking(true);
                          if (!(window as any).ethereum) {
                            throw new Error('MetaMask not detected');
                          }
                          
                          const browserProvider = new BrowserProvider((window as any).ethereum);
                          await browserProvider.send("eth_requestAccounts", []);
                          const signer = await browserProvider.getSigner();
                          
                          // Get inbox ID from sessionStorage or error message
                          let inboxId = sessionStorage.getItem('xmtp_inbox_id');
                          
                          if (!inboxId && error) {
                            const inboxIdMatch = error.match(/InboxID[:\s]+([a-f0-9]{64})/i) || 
                                               error.match(/Inbox\s+ID[:\s]+([a-f0-9]{64})/i);
                            if (inboxIdMatch) {
                              inboxId = inboxIdMatch[1];
                            }
                          }
                          
                          if (!inboxId) {
                            throw new Error('Could not find inbox ID. Please try the "Revoke Installations" button again.');
                          }
                          
                          // Revoke this installation
                          await XmtpService.getInstance().revokeInstallations(
                            signer,
                            inboxId,
                            [inst.bytes],
                            'dev'
                          );
                          
                          alert('✅ Installation revoked successfully! Please try connecting again.');
                          setShowRevokePanel(false);
                          setInstallations([]);
                        } catch (e: any) {
                          console.error('Error revoking installation:', e);
                          alert('Failed to revoke installation: ' + (e.message || 'Unknown error'));
                        } finally {
                          setIsRevoking(false);
                        }
                      }}
                      disabled={isRevoking}
                      style={{
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        cursor: isRevoking ? 'not-allowed' : 'pointer',
                        fontSize: '0.75rem',
                        opacity: isRevoking ? 0.6 : 1
                      }}
                    >
                      {isRevoking ? 'Revoking...' : 'Revoke'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <p>No installations found or could not load them.</p>
                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  Make sure you've connected MetaMask and that the inbox ID in the error message is correct.
                </p>
              </div>
            )}
            <button
              onClick={() => {
                setShowRevokePanel(false);
                setInstallations([]);
              }}
              style={{
                marginTop: '0.75rem',
                background: 'transparent',
                border: '1px solid #92400e',
                color: '#92400e',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Close
            </button>
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

