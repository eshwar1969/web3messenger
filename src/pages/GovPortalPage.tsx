'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';

const GovPortalPage: React.FC = () => {
  const router = useRouter();
  const [authStep, setAuthStep] = useState<'select' | 'hardware' | 'whitelist' | 'verifying'>('select');
  const [hardwareWallet, setHardwareWallet] = useState<string>('');
  const [whitelistCode, setWhitelistCode] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDevMode, setShowDevMode] = useState(false);
  const [showRevokePanel, setShowRevokePanel] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [installations, setInstallations] = useState<any[]>([]);
  const [inboxId, setInboxId] = useState<string | null>(null);

  const handleHardwareWallet = async () => {
    try {
      setIsVerifying(true);
      setError(null);

      // Check if hardware wallet is available
      if (typeof window.ethereum === 'undefined') {
        throw new Error('Hardware wallet not detected. Please connect a supported hardware wallet.');
      }

      // Request hardware wallet connection
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your hardware wallet.');
      }

      const address = accounts[0];
      setHardwareWallet(address);

      // Verify if address is whitelisted (in production, this would check against a government database)
      // For development, we'll auto-whitelist if not already whitelisted
      const isWhitelisted = await verifyWhitelist(address);
      
      if (!isWhitelisted) {
        // Auto-whitelist for development/testing
        const whitelist = JSON.parse(localStorage.getItem('gov_whitelist') || '[]');
        if (!whitelist.includes(address.toLowerCase())) {
          whitelist.push(address.toLowerCase());
          localStorage.setItem('gov_whitelist', JSON.stringify(whitelist));
        }
      }

      // Store auth info and redirect to gov chat
      localStorage.setItem('gov_portal_auth', JSON.stringify({
        address,
        authType: 'hardware',
        timestamp: Date.now()
      }));

      router.push('/gov-portal/chat');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setIsVerifying(false);
    }
  };

  const handleWhitelistAuth = async () => {
    try {
      setIsVerifying(true);
      setError(null);

      if (!whitelistCode || whitelistCode.length < 8) {
        throw new Error('Invalid authorization code');
      }

      // Verify whitelist code (in production, this would verify against a secure server)
      const isValid = await verifyWhitelistCode(whitelistCode);
      
      if (!isValid) {
        throw new Error('Invalid or expired authorization code');
      }

      // Store auth info
      localStorage.setItem('gov_portal_auth', JSON.stringify({
        code: whitelistCode,
        authType: 'whitelist',
        timestamp: Date.now()
      }));

      router.push('/gov-portal/chat');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setIsVerifying(false);
    }
  };

  const verifyWhitelist = async (address: string): Promise<boolean> => {
    // In production, this would make an API call to verify against government database
    // For demo purposes, we'll check localStorage for a whitelist
    const whitelist = JSON.parse(localStorage.getItem('gov_whitelist') || '[]');
    return whitelist.includes(address.toLowerCase());
  };

  const verifyWhitelistCode = async (code: string): Promise<boolean> => {
    // In production, this would verify against a secure server
    // For demo, we'll accept codes starting with "GOV-"
    return code.startsWith('GOV-') && code.length >= 12;
  };

  const handleDevMode = async () => {
    try {
      setIsVerifying(true);
      setError(null);

      // Check if MetaMask is available
      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not detected. Please install MetaMask for development testing.');
      }

      // Request wallet connection
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      
      if (accounts.length === 0) {
        throw new Error('No accounts found. Please unlock your wallet.');
      }

      const address = accounts[0];
      const signer = await provider.getSigner();

      // Try to initialize XMTP to check for installation limit
      try {
        const { XmtpService } = await import('../services/xmtp.service');
        const xmtpService = XmtpService.getInstance();
        await xmtpService.initializeClient(signer, 'dev');
        
        // If successful, proceed
        const authData = {
          address,
          authType: 'dev',
          timestamp: Date.now(),
          isDevMode: true
        };
        localStorage.setItem('gov_portal_auth', JSON.stringify(authData));

        // Also add to whitelist for testing
        const whitelist = JSON.parse(localStorage.getItem('gov_whitelist') || '[]');
        if (!whitelist.includes(address.toLowerCase())) {
          whitelist.push(address.toLowerCase());
          localStorage.setItem('gov_whitelist', JSON.stringify(whitelist));
        }

        router.push('/gov-portal/chat');
      } catch (err: any) {
        const errorMessage = err.message || err.toString() || '';
        
        // Check if it's an installation limit error
        if (errorMessage.includes('10/10 installations') || 
            errorMessage.includes('already registered') ||
            errorMessage.includes('InboxID')) {
          
          // Extract inbox ID
          const inboxIdMatch = errorMessage.match(/InboxID\s+([a-f0-9]{64})/i) || 
                              errorMessage.match(/([a-f0-9]{64})/);
          const extractedInboxId = inboxIdMatch ? inboxIdMatch[1] : null;
          
          setInboxId(extractedInboxId);
          setError('Installation limit reached. Please revoke old installations first.');
          setShowRevokePanel(true);
          setIsVerifying(false);
          return;
        }
        
        // For other errors, still allow dev mode (might be first time setup)
        const authData = {
          address,
          authType: 'dev',
          timestamp: Date.now(),
          isDevMode: true
        };
        localStorage.setItem('gov_portal_auth', JSON.stringify(authData));

        const whitelist = JSON.parse(localStorage.getItem('gov_whitelist') || '[]');
        if (!whitelist.includes(address.toLowerCase())) {
          whitelist.push(address.toLowerCase());
          localStorage.setItem('gov_whitelist', JSON.stringify(whitelist));
        }

        router.push('/gov-portal/chat');
      }
    } catch (err: any) {
      setError(err.message || 'Development mode authentication failed');
      setIsVerifying(false);
    }
  };

  const handleLoadInstallations = async () => {
    try {
      setIsRevoking(true);
      setError(null);

      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not detected');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Get inbox ID if not already extracted
      let targetInboxId = inboxId;
      if (!targetInboxId) {
        // Try to get from sessionStorage or prompt user
        targetInboxId = sessionStorage.getItem('xmtp_inbox_id') || 
                       prompt('Please enter your Inbox ID (64 character hex string):');
        
        if (!targetInboxId || targetInboxId.length !== 64) {
          throw new Error('Invalid inbox ID. Please provide a valid 64-character hex string.');
        }
      }

      const { XmtpService } = await import('../services/xmtp.service');
      const xmtpService = XmtpService.getInstance();
      
      // Get inbox state (list of installations) - method doesn't need signer
      const inboxState = await xmtpService.getInboxState(targetInboxId, 'dev');
      
      console.log('Inbox state received:', inboxState);
      
      if (inboxState && inboxState.installations) {
        setInstallations(inboxState.installations);
        console.log(`Found ${inboxState.installations.length} installation(s)`);
      } else if (inboxState && Array.isArray(inboxState)) {
        // Sometimes the inbox state might be an array directly
        setInstallations(inboxState);
        console.log(`Found ${inboxState.length} installation(s) (direct array)`);
      } else {
        console.error('Unexpected inbox state format:', inboxState);
        setError('No installations found or unable to retrieve them. Check console for details.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load installations');
      console.error('Error loading installations:', err);
    } finally {
      setIsRevoking(false);
    }
  };

  const handleRevokeInstallations = async () => {
    try {
      setIsRevoking(true);
      setError(null);

      if (typeof window.ethereum === 'undefined') {
        throw new Error('MetaMask not detected');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      if (!inboxId) {
        throw new Error('Inbox ID not available');
      }

      if (installations.length === 0) {
        throw new Error('No installations to revoke');
      }

      const { XmtpService } = await import('../services/xmtp.service');
      const xmtpService = XmtpService.getInstance();
      
      // Debug: Log the structure of installations
      console.log('Installations array:', installations);
      console.log('First installation keys:', installations.length > 0 ? Object.keys(installations[0]) : 'No installations');
      if (installations.length > 0) {
        console.log('First installation sample:', {
          keys: Object.keys(installations[0]),
          hasBytes: 'bytes' in installations[0],
          hasInstallationBytes: 'installationBytes' in installations[0],
          hasInstallation: 'installation' in installations[0],
          hasData: 'data' in installations[0],
          sample: installations[0]
        });
      }
      
      // Get installation bytes - handle multiple possible formats
      const installationBytes: Uint8Array[] = [];
      
      for (const inst of installations) {
        let bytes: Uint8Array | null = null;
        
        // Try different possible formats
        if (inst.bytes) {
          bytes = inst.bytes instanceof Uint8Array ? inst.bytes : new Uint8Array(inst.bytes);
        } else if (inst.installationBytes) {
          bytes = inst.installationBytes instanceof Uint8Array ? inst.installationBytes : new Uint8Array(inst.installationBytes);
        } else if (inst.installation) {
          if (inst.installation.bytes) {
            bytes = inst.installation.bytes instanceof Uint8Array ? inst.installation.bytes : new Uint8Array(inst.installation.bytes);
          } else if (inst.installation.installationBytes) {
            bytes = inst.installation.installationBytes instanceof Uint8Array ? inst.installation.installationBytes : new Uint8Array(inst.installation.installationBytes);
          }
        } else if (inst.data) {
          bytes = inst.data instanceof Uint8Array ? inst.data : new Uint8Array(inst.data);
        }
        
        if (bytes && bytes.length > 0) {
          installationBytes.push(bytes);
        } else {
          console.warn('Could not extract bytes from installation:', inst);
        }
      }

      if (installationBytes.length === 0) {
        console.error('Installations array:', installations);
        throw new Error(`No valid installation data found. Found ${installations.length} installation(s) but could not extract bytes. Check console for details.`);
      }
      
      console.log(`Successfully extracted ${installationBytes.length} installation(s) with bytes`);

      // Revoke all installations
      await xmtpService.revokeInstallations(signer, inboxId, installationBytes, 'dev');
      
      setError(null);
      alert('✅ All installations revoked successfully! You can now try connecting again.');
      setShowRevokePanel(false);
      setInstallations([]);
      setInboxId(null);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke installations');
      console.error('Error revoking installations:', err);
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="landing-container">
      <div className="landing-content">
        <div className="landing-card">
          <div className="landing-logo">
            <h1>🛡️ Government Portal</h1>
            <p>Secure, Private, Sovereign Network Access</p>
          </div>

          {authStep === 'select' && (
            <>
              <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
                  Authenticate using one of the following methods:
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => setAuthStep('hardware')}
                    style={{ width: '100%' }}
                  >
                    🔐 Hardware Wallet Authentication
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setAuthStep('whitelist')}
                    style={{ width: '100%' }}
                  >
                    🎫 Whitelisted Identity Code
                  </button>
                  
                  {/* Development/Testing Mode */}
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '1rem', 
                    background: 'rgba(251, 191, 36, 0.1)', 
                    borderRadius: '8px',
                    border: '1px solid rgba(251, 191, 36, 0.3)'
                  }}>
                    <p style={{ 
                      fontSize: '0.75rem', 
                      color: '#fbbf24', 
                      marginBottom: '0.75rem',
                      fontWeight: '600',
                      textAlign: 'center'
                    }}>
                      🧪 DEVELOPMENT MODE
                    </p>
                    <button 
                      className="btn btn-secondary" 
                      onClick={handleDevMode}
                      disabled={isVerifying}
                      style={{ 
                        width: '100%',
                        background: 'rgba(251, 191, 36, 0.2)',
                        border: '1px solid rgba(251, 191, 36, 0.4)',
                        color: '#fbbf24'
                      }}
                    >
                      {isVerifying ? 'Connecting...' : '🔧 Connect with MetaMask (Testing)'}
                    </button>
                    <p style={{ 
                      fontSize: '0.7rem', 
                      color: 'rgba(251, 191, 36, 0.8)', 
                      marginTop: '0.5rem',
                      textAlign: 'center',
                      margin: '0.5rem 0 0 0'
                    }}>
                      For development and testing only
                    </p>
                  </div>
                  
                  {/* Error display for dev mode */}
                  {error && error.includes('Installation limit') && (
                    <div style={{ 
                      marginTop: '1rem',
                      padding: '1rem', 
                      background: 'rgba(220, 38, 38, 0.1)', 
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      borderRadius: '8px',
                      color: '#fca5a5',
                      fontSize: '0.875rem'
                    }}>
                      {error}
                      <div style={{ marginTop: '0.75rem' }}>
                        <button
                          onClick={() => setShowRevokePanel(!showRevokePanel)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(220, 38, 38, 0.2)',
                            border: '1px solid rgba(220, 38, 38, 0.4)',
                            borderRadius: '6px',
                            color: '#fca5a5',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '600'
                          }}
                        >
                          {showRevokePanel ? 'Hide' : 'Show'} Installation Management
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button 
                className="btn btn-secondary" 
                onClick={() => router.push('/')}
                style={{ width: '100%', marginTop: '1rem' }}
              >
                ← Back to Home
              </button>
            </>
          )}

          {authStep === 'hardware' && (
            <>
              <div style={{ marginTop: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
                  Connect your government-issued hardware wallet
                </p>
                
                {error && (
                  <div style={{ 
                    padding: '1rem', 
                    background: 'rgba(220, 38, 38, 0.1)', 
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    color: '#fca5a5'
                  }}>
                    {error}
                  </div>
                )}

                <button 
                  className="btn btn-primary" 
                  onClick={handleHardwareWallet}
                  disabled={isVerifying}
                  style={{ width: '100%' }}
                >
                  {isVerifying ? 'Verifying...' : '🔐 Connect Hardware Wallet'}
                </button>

                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setAuthStep('select');
                    setError(null);
                  }}
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  ← Back
                </button>
              </div>
            </>
          )}

          {authStep === 'whitelist' && (
            <>
              <div style={{ marginTop: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'center' }}>
                  Enter your government-issued authorization code
                </p>
                
                {error && (
                  <div style={{ 
                    padding: '1rem', 
                    background: 'rgba(220, 38, 38, 0.1)', 
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    color: '#fca5a5'
                  }}>
                    {error}
                  </div>
                )}

                <input
                  type="text"
                  value={whitelistCode}
                  onChange={(e) => setWhitelistCode(e.target.value)}
                  placeholder="Enter authorization code (e.g., GOV-XXXX-XXXX)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(26, 26, 26, 0.5)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.95rem',
                    marginBottom: '1rem'
                  }}
                  disabled={isVerifying}
                />

                <button 
                  className="btn btn-primary" 
                  onClick={handleWhitelistAuth}
                  disabled={isVerifying || !whitelistCode}
                  style={{ width: '100%' }}
                >
                  {isVerifying ? 'Verifying...' : '🎫 Verify Code'}
                </button>

                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setAuthStep('select');
                    setError(null);
                    setWhitelistCode('');
                  }}
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  ← Back
                </button>
              </div>
            </>
          )}

          {/* Revoke Installations Panel */}
          {showRevokePanel && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1.5rem',
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '12px'
            }}>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                marginBottom: '1rem',
                color: '#fbbf24'
              }}>
                🔧 Revoke Installations (Recommended)
              </h3>
              
              {inboxId && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '0.75rem', 
                    fontWeight: '600', 
                    marginBottom: '0.5rem',
                    color: 'var(--text-secondary)'
                  }}>
                    Your Inbox ID:
                  </label>
                  <div style={{
                    padding: '0.75rem',
                    background: 'rgba(26, 26, 26, 0.5)',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)'
                  }}>
                    {inboxId}
                  </div>
                </div>
              )}

              {installations.length === 0 ? (
                <div>
                  <button
                    onClick={handleLoadInstallations}
                    disabled={isRevoking}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(251, 191, 36, 0.2)',
                      border: '1px solid rgba(251, 191, 36, 0.4)',
                      borderRadius: '8px',
                      color: '#fbbf24',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}
                  >
                    {isRevoking ? 'Loading...' : '📋 Load Installations'}
                  </button>
                  <p style={{ 
                    fontSize: '0.7rem', 
                    color: 'rgba(251, 191, 36, 0.8)', 
                    marginTop: '0.75rem',
                    textAlign: 'center'
                  }}>
                    Click to load your existing installations
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '0.75rem'
                  }}>
                    Found {installations.length} installation(s):
                  </p>
                  <div style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    marginBottom: '1rem',
                    padding: '0.5rem',
                    background: 'rgba(26, 26, 26, 0.3)',
                    borderRadius: '8px'
                  }}>
                    {installations.map((inst: any, index: number) => (
                      <div key={index} style={{
                        padding: '0.5rem',
                        marginBottom: '0.5rem',
                        background: 'rgba(26, 26, 26, 0.5)',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace'
                      }}>
                        Installation #{index + 1}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleRevokeInstallations}
                    disabled={isRevoking}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(220, 38, 38, 0.2)',
                      border: '1px solid rgba(220, 38, 38, 0.4)',
                      borderRadius: '8px',
                      color: '#fca5a5',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}
                  >
                    {isRevoking ? 'Revoking...' : '🗑️ Revoke All Installations'}
                  </button>
                  <p style={{ 
                    fontSize: '0.7rem', 
                    color: 'rgba(251, 191, 36, 0.8)', 
                    marginTop: '0.75rem',
                    textAlign: 'center'
                  }}>
                    ⚠️ This will revoke all {installations.length} installation(s). You'll need to reconnect after this.
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem', 
            background: 'rgba(59, 130, 246, 0.1)', 
            borderRadius: '8px',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
              ⚠️ This portal provides access to a private, air-gapped network. 
              All communications are sovereign and never touch the public internet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovPortalPage;

