'use client';

import React, { useState } from 'react';
import { useConversations } from '../hooks/useConversations';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';

const CreateRoom: React.FC = () => {
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<any>(null);
  const { loadConversations, selectConversation } = useConversations();
  const { xmtpClient } = useAppStore();

  const handleCreateRoom = async () => {
    if (!xmtpClient) {
      alert('Please connect your wallet first');
      return;
    }

    if (!roomName.trim()) {
      alert('Please enter a room name');
      return;
    }

    try {
      setIsCreating(true);

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '🏠 Creating conversation room...', type: 'info' }
      }));

      // Create a group conversation (room) 
      // Start with empty array - creator is automatically added
      const room = await XmtpService.getInstance().createGroup([]);
      
      // Send room name as first message
      if (roomName.trim()) {
        try {
          await room.send(`🏠 Room: ${roomName.trim()}\n\nRoom ID: ${room.id}\n\nShare this Room ID with others to join!`);
        } catch (e) {
          console.log('Could not send room name message:', e);
        }
      } else {
        // Send room ID even if no name
        try {
          await room.send(`🏠 Room created!\n\nRoom ID: ${room.id}\n\nShare this Room ID with others to join!`);
        } catch (e) {
          console.log('Could not send room ID message:', e);
        }
      }

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `✅ Room "${roomName}" created!`, type: 'success' }
      }));

      setCreatedRoom(room);
      setRoomName('');

      // Reload conversations and select the new room
      await loadConversations();
      const conversations = useAppStore.getState().conversations;
      const idx = conversations.findIndex((c: any) => c.id === room.id);
      if (idx !== -1) {
        selectConversation(idx);
      }

    } catch (error) {
      console.error('Error creating room:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `❌ Failed to create room: ${errorMsg}`, type: 'error' }
      }));
      alert('Unable to create room: ' + errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyRoomId = () => {
    if (createdRoom?.id) {
      navigator.clipboard.writeText(createdRoom.id);
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '📋 Room ID copied to clipboard!', type: 'success' }
      }));
      alert('Room ID copied! Share this with others to join the room.');
    }
  };

  return (
    <div className="sidebar-card">
      <div className="card-header">
        <h2>Create Room</h2>
        <span className="card-subtitle">Start a group conversation</span>
      </div>

      {createdRoom ? (
        <div className="room-created">
          <div className="info-box success" style={{ padding: '16px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#166534' }}><strong>✅ Room Created!</strong></p>
            <p style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Share this Room ID with others to join:</p>
            <div className="room-id-display" style={{ 
              background: '#fff', 
              padding: '12px', 
              borderRadius: '6px', 
              border: '1px solid #d1d5db',
              marginBottom: '12px',
              wordBreak: 'break-all'
            }}>
              <code style={{ fontSize: '12px', fontFamily: 'monospace' }}>{createdRoom.id}</code>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="primary-action"
                onClick={handleCopyRoomId}
                title="Copy Room ID"
                style={{ flex: 1 }}
              >
                📋 Copy Room ID
              </button>
              <button
                className="secondary-action"
                onClick={() => setCreatedRoom(null)}
                style={{ flex: 1 }}
              >
                Create Another
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <input
            type="text"
            placeholder="Enter room name (optional)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateRoom();
              }
            }}
            disabled={isCreating}
          />
          <button
            className="secondary-action"
            onClick={handleCreateRoom}
            disabled={isCreating || !xmtpClient}
          >
            {isCreating ? 'Creating...' : '🏠 Create Room'}
          </button>
          <div className="info-box subtle">
            💡 Rooms allow multiple people to chat together. Share the Room ID to invite others.
          </div>
        </>
      )}
    </div>
  );
};

export default CreateRoom;

