'use client';

import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useConversations } from '../hooks/useConversations';
import { XmtpService } from '../services/xmtp.service';

interface AddRoomMemberProps {
  conversation: any;
  onMemberAdded?: () => void;
}

const AddRoomMember: React.FC<AddRoomMemberProps> = ({ conversation, onMemberAdded }) => {
  const [memberAddress, setMemberAddress] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { xmtpClient, walletAddress } = useAppStore();
  const { loadConversations } = useConversations();

  const handleAddMember = async () => {
    if (!conversation || conversation.version === 'DM') {
      alert('Can only add members to rooms, not DMs');
      return;
    }

    if (!memberAddress.trim()) {
      alert('Please enter a wallet address or inbox ID');
      return;
    }

    const input = memberAddress.trim();
    let inboxId: string | null = null;

    // Use input as inbox ID directly (clean and simple)
    setIsAdding(true);
    inboxId = input;
    
    window.dispatchEvent(new CustomEvent('app-log', {
      detail: { message: `📬 Adding member with inbox ID...`, type: 'info' }
    }));

    if (!inboxId) {
      setIsAdding(false);
      return;
    }

    try {

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `➕ Adding member to room...`, type: 'info' }
      }));

      // Add member to the group conversation using inbox ID
      if (conversation.addMembers) {
        await conversation.addMembers([inboxId]);
      } else if (conversation.add) {
        await conversation.add([inboxId]);
      } else {
        throw new Error('Cannot add members to this conversation');
      }

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `✅ Member added to room!`, type: 'success' }
      }));

      setMemberAddress('');
      
      // Sync the conversation to get updated member list
      try {
        await conversation.sync();
      } catch (e) {
        console.log('Sync error (non-critical):', e);
      }
      
      // Reload conversations to update member count
      await loadConversations();
      
      // Force a re-render by updating the current conversation with synced data
      const updatedConversations = useAppStore.getState().conversations;
      const currentConv = useAppStore.getState().currentConversation;
      if (currentConv) {
        const updatedConv = updatedConversations.find((c: any) => c.id === currentConv.id);
        if (updatedConv) {
          // Sync the updated conversation to get latest member count
          try {
            await updatedConv.sync();
          } catch (e) {
            console.log('Sync error (non-critical):', e);
          }
          useAppStore.getState().setCurrentConversation(updatedConv);
        }
      }
      
      if (onMemberAdded) {
        onMemberAdded();
      }

    } catch (error) {
      console.error('Error adding member:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `❌ Failed to add member: ${errorMsg}`, type: 'error' }
      }));
      alert('Unable to add member: ' + errorMsg);
    } finally {
      setIsAdding(false);
    }
  };

  if (!conversation || conversation.version === 'DM') {
    return null;
  }

  return (
    <div style={{ padding: '0.75rem 1rem', background: 'var(--background-light)', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
        ➕ Add Member
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Enter inbox ID"
          value={memberAddress}
          onChange={(e) => setMemberAddress(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAddMember();
            }
          }}
          disabled={isAdding}
          style={{ 
            flex: 1, 
            padding: '0.625rem', 
            fontSize: '0.875rem', 
            border: '1px solid var(--border-color)', 
            borderRadius: '8px',
            background: 'white'
          }}
        />
        <button
          className="btn btn-primary"
          onClick={handleAddMember}
          disabled={isAdding || !memberAddress.trim()}
          style={{ 
            padding: '0.625rem 1.25rem', 
            fontSize: '0.875rem', 
            whiteSpace: 'nowrap',
            fontWeight: '600',
            borderRadius: '8px'
          }}
        >
          {isAdding ? 'Adding...' : 'Add'}
        </button>
      </div>
    </div>
  );
};

export default AddRoomMember;

