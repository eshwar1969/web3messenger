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
  const [memberInboxId, setMemberInboxId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const { xmtpClient } = useAppStore();
  const { loadConversations } = useConversations();

  const handleAddMember = async () => {
    if (!conversation || conversation.version === 'DM') {
      alert('Can only add members to rooms, not DMs');
      return;
    }

    if (!memberInboxId.trim()) {
      alert('Please enter an inbox ID');
      return;
    }

    try {
      setIsAdding(true);

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `➕ Adding member to room...`, type: 'info' }
      }));

      // Add member to the group conversation
      // In XMTP browser SDK, you can add members using addMembers
      if (conversation.addMembers) {
        await conversation.addMembers([memberInboxId.trim()]);
      } else if (conversation.add) {
        await conversation.add([memberInboxId.trim()]);
      } else {
        // Try alternative method
        const updated = await XmtpService.getInstance().createGroup([
          ...(conversation.memberInboxIds || []),
          memberInboxId.trim()
        ]);
        if (updated) {
          window.dispatchEvent(new CustomEvent('app-log', {
            detail: { message: `✅ Member added! Room updated.`, type: 'success' }
          }));
        }
      }

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `✅ Member added to room!`, type: 'success' }
      }));

      setMemberInboxId('');
      
      // Reload conversations to update member count
      await loadConversations();
      
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
    <div style={{ marginTop: '12px', padding: '12px', background: '#f5f7fb', borderRadius: '8px' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Add Member to Room</div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Enter inbox ID to add"
          value={memberInboxId}
          onChange={(e) => setMemberInboxId(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAddMember();
            }
          }}
          disabled={isAdding}
          style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
        />
        <button
          className="ghost-action tiny"
          onClick={handleAddMember}
          disabled={isAdding || !memberInboxId.trim()}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          {isAdding ? 'Adding...' : '➕ Add'}
        </button>
      </div>
      <div style={{ fontSize: '11px', color: '#718096', marginTop: '6px' }}>
        Share your inbox ID: <code style={{ fontSize: '10px' }}>{xmtpClient?.inboxId}</code>
      </div>
    </div>
  );
};

export default AddRoomMember;

