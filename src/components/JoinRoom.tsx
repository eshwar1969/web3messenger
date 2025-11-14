'use client';

import React, { useState } from 'react';
import { useConversations } from '../hooks/useConversations';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';

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
        // Room not in our conversations - might need to be added as member
        // For now, show helpful message
        alert(`Room ID "${roomId.trim()}" not found in your conversations.\n\n` +
              `To join a room:\n` +
              `1. Ask the room creator to add your inbox ID as a member\n` +
              `2. Your inbox ID: ${xmtpClient.inboxId}\n` +
              `3. Once added, the room will appear in your conversations`);
        setIsJoining(false);
        return;
      }

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '✅ Joined room successfully!', type: 'success' }
      }));

      setRoomId('');

      // Select the room
      await loadConversations();
      const updatedConversations = useAppStore.getState().conversations;
      const idx = updatedConversations.findIndex((c: any) => c.id === room.id);
      if (idx !== -1) {
        selectConversation(idx);
      } else {
        // If still not found, try to add user to the group
        // This might require the room creator to add members
        alert('Room found but you may need to be added as a member. Contact the room creator.');
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

      <div className="info-box subtle">
        🔗 Get the Room ID from the room creator and paste it here to join.
      </div>
    </div>
  );
};

export default JoinRoom;

