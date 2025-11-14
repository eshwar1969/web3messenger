'use client';

import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useXmtp } from '../hooks/useXmtp';
import { ProfileService } from '../services/profile.service';
import { FormatUtils } from '../utils/format';

const WalletInfo: React.FC = () => {
  const { userProfile, xmtpClient, walletAddress, isConnected } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load profile on mount
  useEffect(() => {
    if (walletAddress) {
      ProfileService.getInstance().loadUserProfile();
    }
  }, [walletAddress]);

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

  // Show loading state if connected but wallet info not yet available
  if (isConnected && !walletAddress) {
    return (
      <div className="wallet-info">
        <p>Loading wallet information...</p>
      </div>
    );
  }

  // Don't show if not connected
  if (!walletAddress) return null;

  return (
    <>
      {hasName && (
        <div className="profile-chip">
          <span>@{userProfile.username}</span>
          <span className="chip-secondary">Share this with your inbox ID</span>
        </div>
      )}
      <div className="wallet-info">
        <div className="wallet-line">
          <div>
            <p><strong>🙋 Display name</strong></p>
            <p className="wallet-subtext">
              {hasName ? `@${userProfile.username}` : <span className="wallet-subtext muted">Not set yet</span>}
            </p>
          </div>
        </div>
        <div className="profile-picture-section">
          <div className="profile-picture-container">
            {userProfile.profilePicture ? (
              <img
                src={userProfile.profilePicture}
                alt="Profile Picture"
                style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div className="profile-picture-placeholder">👤</div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleProfilePictureChange}
            />
            <button
              className="ghost-action tiny"
              onClick={() => fileInputRef.current?.click()}
            >
              Change Picture
            </button>
          </div>
        </div>
        <p><strong>🦊 Wallet:</strong> MetaMask</p>
        <p><strong>🔑 Address:</strong> <code>{walletAddress}</code></p>
        {xmtpClient ? (
          <>
            <p><strong>📬 Inbox ID:</strong> <code>{xmtpClient.inboxId}</code></p>
            <p><strong>🌐 XMTP network:</strong> DEV (testing)</p>
            <p className="wallet-subtext success">✅ Your MetaMask identity is now live on XMTP</p>
          </>
        ) : (
          <p className="wallet-subtext">⏳ Initializing XMTP client...</p>
        )}
      </div>
    </>
  );
};

export default WalletInfo;

