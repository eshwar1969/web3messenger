'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useXmtp } from '../hooks/useXmtp';
import { ProfileService } from '../services/profile.service';
import { FormatUtils } from '../utils/format';

const WalletInfo: React.FC = () => {
  const { userProfile, xmtpClient, walletAddress, signer } = useAppStore();
  const { walletAddress: walletAddressFromHook } = useXmtp(); // Also get from hook as fallback
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  
  // Use walletAddress from store, fallback to hook if store is null
  const displayWalletAddress = walletAddress || walletAddressFromHook;

  // Try to get address from signer if we don't have it
  useEffect(() => {
    const resolveAddress = async () => {
      if (displayWalletAddress) {
        setResolvedAddress(displayWalletAddress);
        return;
      }
      
      if (signer) {
        try {
          const address = await signer.getAddress();
          setResolvedAddress(address);
          // Also update the store if it's missing
          if (!walletAddress) {
            useAppStore.getState().setWalletAddress(address);
          }
        } catch (error) {
          console.error('Failed to get address from signer:', error);
        }
      }
    };
    
    resolveAddress();
  }, [displayWalletAddress, signer, walletAddress]);

  // Debug logging
  useEffect(() => {
    console.log('WalletInfo - walletAddress from store:', walletAddress);
    console.log('WalletInfo - walletAddress from hook:', walletAddressFromHook);
    console.log('WalletInfo - resolvedAddress:', resolvedAddress);
    console.log('WalletInfo - xmtpClient:', xmtpClient);
  }, [walletAddress, walletAddressFromHook, resolvedAddress, xmtpClient]);

  // Load profile on mount
  useEffect(() => {
    if (displayWalletAddress) {
      ProfileService.getInstance().loadUserProfile();
    }
  }, [displayWalletAddress]);

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: '📸 Uploading profile picture...', type: 'info' }
        }));
        
        await ProfileService.getInstance().handleProfilePictureUpload(file);
        
        // Dispatch success log
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: '✅ Profile picture updated!', type: 'success' }
        }));
        
        console.log('Profile picture uploaded successfully');
      } catch (error) {
        console.error('Failed to upload profile picture:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `❌ Profile picture upload failed: ${errorMsg}`, type: 'error' }
        }));
        
        alert('Failed to upload profile picture. Please try again.');
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const hasName = Boolean(userProfile.username);

  // Always show if we have wallet address OR xmtpClient (even if address is missing from store)
  // This ensures the component renders as soon as wallet is connected
  const finalWalletAddress = resolvedAddress || displayWalletAddress;
  
  if (!finalWalletAddress && !xmtpClient) {
    console.log('WalletInfo: Not rendering - no address or client');
    return null;
  }

  return (
    <>
      {hasName && (
        <div className="profile-chip">
          <span>@{userProfile.username}</span>
          <span className="chip-secondary">Share this with your inbox ID</span>
        </div>
      )}
      <div className="wallet-info">
        <div className="profile-picture-section" style={{ marginBottom: '16px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}><strong>📸 Profile Picture</strong></p>
          <div className="profile-picture-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {userProfile.profilePicture ? (
              <img
                src={userProfile.profilePicture}
                alt="Profile Picture"
                style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #cbd5e0' }}
              />
            ) : (
              <div className="profile-picture-placeholder" style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', border: '2px solid #cbd5e0' }}>👤</div>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleProfilePictureChange}
              />
              <button
                className="ghost-action"
                onClick={() => fileInputRef.current?.click()}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                {userProfile.profilePicture ? '🔄 Change Picture' : '➕ Add Picture'}
              </button>
            </div>
          </div>
        </div>
        <div className="wallet-line">
          <div>
            <p><strong>🙋 Display name</strong></p>
            <p className="wallet-subtext">
              {hasName ? `@${userProfile.username}` : <span className="wallet-subtext muted">Not set yet</span>}
            </p>
          </div>
        </div>
        <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac', marginBottom: '12px' }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', color: '#166534' }}><strong>🔑 Your Wallet Address</strong></p>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', wordBreak: 'break-all', fontFamily: 'monospace', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e0' }}>
            {finalWalletAddress || 'Not available'}
          </p>
          {finalWalletAddress && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(finalWalletAddress);
                window.dispatchEvent(new CustomEvent('app-log', {
                  detail: { message: '📋 Wallet address copied!', type: 'success' }
                }));
              }}
              className="ghost-action tiny"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              📋 Copy Address
            </button>
          )}
        </div>
        <p><strong>🦊 Wallet:</strong> MetaMask</p>
        {xmtpClient && xmtpClient.inboxId ? (
          <>
            <p><strong>🌐 XMTP network:</strong> DEV (testing)</p>
            <p className="wallet-subtext success">✅ Connected to XMTP</p>
            <details style={{ marginTop: '8px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#718096' }}>Show Inbox ID (advanced)</summary>
              <p style={{ marginTop: '4px', fontSize: '11px', wordBreak: 'break-all', fontFamily: 'monospace' }}>{xmtpClient.inboxId}</p>
            </details>
          </>
        ) : (
          <p className="wallet-subtext">⏳ Initializing XMTP client...</p>
        )}
      </div>
    </>
  );
};

export default WalletInfo;

