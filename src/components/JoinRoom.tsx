'use client';

import React, { useState } from 'react';
import { useConversations } from '../hooks/useConversations';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';
import { FormatUtils } from '../utils/format';

const JoinRoom: React.FC = () => {
  const [roomId, setRoomId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const { loadConversations, selectConversation } = useConversations();
  const { xmtpClient } = useAppStore();

  const handleJoinRoom = async () => {
    if (!xmtpClient) {
      alert('Please connect your wallet first');
      return;
    }

    if (!roomId.trim()) {
      alert('Please enter a Room ID');
      return;
    }

    try {
      setIsJoining(true);

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '🚪 Joining room...', type: 'info' }
      }));

      // Try to find the conversation by ID in existing conversations
      const conversations = await XmtpService.getInstance().loadConversations();
      let room = conversations.find((c: any) => c.id === roomId.trim() || c.id?.includes(roomId.trim()));

      if (!room) {
        // Room not found - show instructions with copy button for wallet address
        const walletAddr = useAppStore.getState().walletAddress;
        const message = `Room ID "${roomId.trim()}" not found.\n\n` +
              `To join:\n` +
              `1. Copy your wallet address (shown below)\n` +
              `2. Send it to the room creator\n` +
              `3. They'll add you to the room\n` +
              `4. The room will appear in your conversations\n\n` +
              `Your Wallet Address:\n${walletAddr || 'Not available'}`;
        
        // Copy wallet address to clipboard
        if (walletAddr) {
          navigator.clipboard.writeText(walletAddr).then(() => {
            alert(message + '\n\n✅ Your wallet address has been copied to clipboard!');
          }).catch(() => {
            alert(message);
          });
        } else {
          alert(message);
        }
        
        setIsJoining(false);
        return;
      }

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '✅ Room found! Opening...', type: 'success' }
      }));

      setRoomId('');

      // Reload conversations and select the room
      await loadConversations();
      const updatedConversations = useAppStore.getState().conversations;
      const idx = updatedConversations.findIndex((c: any) => c.id === room.id || c.id?.includes(room.id));
      if (idx !== -1) {
        selectConversation(idx);
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: '✅ Room opened successfully!', type: 'success' }
        }));
      } else {
        alert('Room found but could not be opened. Try refreshing the conversations list.');
      }

    } catch (error) {
      console.error('Error joining room:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `❌ Failed to join room: ${errorMsg}`, type: 'error' }
      }));
      alert('Unable to join room: ' + errorMsg);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="sidebar-card">
      <div className="card-header">
        <h2>Join Room</h2>
        <span className="card-subtitle">Enter a Room ID to join</span>
      </div>

      <input
        type="text"
        placeholder="Paste Room ID here"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleJoinRoom();
          }
        }}
        disabled={isJoining}
      />

      <button
        className="secondary-action"
        onClick={handleJoinRoom}
        disabled={isJoining || !xmtpClient || !roomId.trim()}
      >
        {isJoining ? 'Joining...' : '🚪 Join Room'}
      </button>

      <div className="info-box subtle" style={{ marginTop: '12px', padding: '10px', background: '#f8fafc', borderRadius: '6px', fontSize: '12px' }}>
        <div style={{ marginBottom: '8px' }}>
          <strong>💡 How to join:</strong>
        </div>
        <ol style={{ margin: '0', paddingLeft: '20px', lineHeight: '1.6' }}>
          <li>Get the Room ID from the room creator</li>
          <li>Paste it above and click "Join Room"</li>
          <li>If room not found, share your wallet address with the creator</li>
        </ol>
        {useAppStore.getState().walletAddress && (
          <div style={{ marginTop: '8px', padding: '12px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <strong style={{ fontSize: '12px', color: '#1a202c' }}>Your wallet address:</strong>
              <button
                onClick={() => {
                  const addr = useAppStore.getState().walletAddress;
                  if (addr) {
                    navigator.clipboard.writeText(addr);
                    window.dispatchEvent(new CustomEvent('app-log', {
                      detail: { message: '📋 Wallet address copied!', type: 'success' }
                    }));
                  }
                }}
                className="ghost-action tiny"
                style={{ padding: '4px 8px', fontSize: '11px' }}
                title="Copy address"
              >
                📋 Copy
              </button>
            </div>
            <code style={{ 
              fontSize: '11px', 
              fontFamily: 'monospace', 
              wordBreak: 'break-all', 
              display: 'block',
              padding: '8px',
              background: '#f8fafc',
              borderRadius: '4px',
              color: '#1a202c'
            }}>
              {useAppStore.getState().walletAddress}
            </code>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinRoom;

