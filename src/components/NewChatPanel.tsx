'use client';

import React, { useState } from 'react';
import { useConversations } from '../hooks/useConversations';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';
import { ConversationService } from '../services/conversation.service';

interface NewChatPanelProps {
  onClose: () => void;
}

const NewChatPanel: React.FC<NewChatPanelProps> = ({ onClose }) => {
  const [mode, setMode] = useState<'dm' | 'room'>('dm');
  const [input, setInput] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<any>(null);
  const { createDM, loadConversations, selectConversation } = useConversations();
  const { xmtpClient, walletAddress } = useAppStore();

  const handleStartDM = async () => {
    if (!xmtpClient || !input.trim()) return;

    try {
      setIsCreating(true);
      const inboxId = input.trim().toLowerCase();

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `📬 Starting DM with inbox ID...`, type: 'info' }
      }));

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '💬 Creating DM conversation...', type: 'info' }
      }));

      // Create or get DM
      const dm = await createDM(inboxId);

      if (dm) {
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: '✅ DM conversation ready!', type: 'success' }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: '✅ New DM conversation created!', type: 'success' }
        }));
      }

      // Reload conversations and automatically open the conversation
      await loadConversations();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedConversations = useAppStore.getState().conversations;
      const idx = updatedConversations.findIndex((c: any) => c.peerInboxId === inboxId || c.id === dm?.id);
      if (idx !== -1) {
        selectConversation(idx);
        onClose();
      }
      setInput('');
    } catch (error) {
      console.error('Error creating DM:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `❌ Error: ${errorMsg}`, type: 'error' }
      }));
      alert('Unable to create conversation: ' + errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!xmtpClient) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setIsCreating(true);

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '🏠 Creating conversation room...', type: 'info' }
      }));

      // Create a group conversation (room)
      const room = await XmtpService.getInstance().createGroup([]);
      
      // Assign room number
      const roomNumber = ConversationService.getInstance().assignRoomNumber(room.id);
      const roomDisplayName = roomName.trim() || `Room ${roomNumber}`;
      
      // Set the room name
      ConversationService.getInstance().setConversationName(room.id, roomDisplayName);
      
      // Send room info as first message
      const roomInfoMessage = `🏠 ${roomDisplayName}\n\nRoom ID: ${room.id}\n\nShare this Room ID with others. They'll need to share their inbox ID with you to be added.`;
      
      try {
        await room.send(roomInfoMessage);
      } catch (e) {
        console.log('Could not send room info message:', e);
      }

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `✅ Room created!`, type: 'success' }
      }));

      setCreatedRoom(room);
      setRoomName('');

      // Reload conversations and select the new room
      await loadConversations();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedConversations = useAppStore.getState().conversations;
      const idx = updatedConversations.findIndex((c: any) => c.id === room.id);
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

  if (createdRoom) {
    return (
      <div style={{ padding: '1rem', background: 'var(--background-light)', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>Room Created!</h3>
        <div style={{ 
          padding: '12px', 
          background: '#f0fdf4', 
          border: '1px solid #86efac', 
          borderRadius: '8px',
          marginBottom: '12px'
        }}>
          <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '600', color: '#166534' }}>
            ✅ Room created successfully!
          </p>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
            Share this Room ID with others to join:
          </p>
          <div style={{ 
            background: '#fff', 
            padding: '10px', 
            borderRadius: '6px', 
            border: '1px solid #d1d5db',
            marginBottom: '10px',
            wordBreak: 'break-all',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            {createdRoom.id}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCopyRoomId}
              className="btn btn-primary"
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
            >
              📋 Copy Room ID
            </button>
            <button
              onClick={() => {
                setCreatedRoom(null);
                setRoomName('');
                onClose();
              }}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', background: 'var(--background-light)', borderBottom: '1px solid var(--border-color)' }}>
      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>New Chat</h3>
      
      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '4px' }}>
        <button
          onClick={() => {
            setMode('dm');
            setInput('');
            setRoomName('');
          }}
          style={{
            flex: 1,
            padding: '0.5rem',
            fontSize: '0.875rem',
            border: 'none',
            borderRadius: '6px',
            background: mode === 'dm' ? '#667eea' : 'transparent',
            color: mode === 'dm' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: mode === 'dm' ? '600' : '400'
          }}
        >
          💬 Start DM
        </button>
        <button
          onClick={() => {
            setMode('room');
            setInput('');
            setRoomName('');
          }}
          style={{
            flex: 1,
            padding: '0.5rem',
            fontSize: '0.875rem',
            border: 'none',
            borderRadius: '6px',
            background: mode === 'room' ? '#667eea' : 'transparent',
            color: mode === 'room' ? 'white' : 'var(--text-primary)',
            cursor: 'pointer',
            fontWeight: mode === 'room' ? '600' : '400'
          }}
        >
          🏠 Create Room
        </button>
      </div>

      {mode === 'dm' ? (
        <>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Enter Inbox ID
            </label>
            <input
              type="text"
              placeholder="e.g., peer.inbox.xyz"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleStartDM();
                }
              }}
              disabled={isCreating}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'white'
              }}
            />
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-secondary)', 
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: '#f0f7ff',
              borderRadius: '6px',
              border: '1px solid #dbeafe'
            }}>
              <strong>💡 How to get inbox ID:</strong>
              <div style={{ marginTop: '0.25rem', fontSize: '0.7rem' }}>
                Ask your contact to click their profile picture → their inbox ID will be shown
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleStartDM}
            disabled={!input.trim() || isCreating}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              fontSize: '0.875rem', 
              marginBottom: '0.5rem',
              fontWeight: '600'
            }}
          >
            {isCreating ? 'Creating...' : '💬 Start DM'}
          </button>
        </>
      ) : (
        <>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Room Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Team Chat, Project Discussion"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateRoom();
                }
              }}
              disabled={isCreating}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'white'
              }}
            />
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-secondary)', 
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: '#f0fdf4',
              borderRadius: '6px',
              border: '1px solid #d1fae5'
            }}>
              💡 If no name is provided, room will be auto-numbered (Room 1, Room 2, etc.)
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleCreateRoom}
            disabled={isCreating || !xmtpClient}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              fontSize: '0.875rem', 
              marginBottom: '0.5rem',
              fontWeight: '600'
            }}
          >
            {isCreating ? 'Creating...' : '🏠 Create Room'}
          </button>
        </>
      )}

      <button 
        className="btn btn-secondary" 
        onClick={onClose}
        style={{ width: '100%', padding: '0.625rem', fontSize: '0.875rem' }}
      >
        Close
      </button>
    </div>
  );
};

export default NewChatPanel;

