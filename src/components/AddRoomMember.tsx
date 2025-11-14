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
      alert('Please enter a wallet address');
      return;
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/i.test(memberAddress.trim())) {
      alert('Invalid wallet address. Please use a valid Ethereum address (0x...).');
      return;
    }

    try {
      setIsAdding(true);

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `🔍 Looking up wallet address...`, type: 'info' }
      }));

      // Resolve wallet address to inbox ID
      let inboxId: string | null = null;
      let retries = 5;
      
      while (retries > 0 && !inboxId) {
        try {
          inboxId = await XmtpService.getInstance().getInboxIdByAddress(memberAddress.trim().toLowerCase());
          if (inboxId) {
            window.dispatchEvent(new CustomEvent('app-log', {
              detail: { message: `✅ Found inbox ID for address`, type: 'success' }
            }));
            break;
          }
        } catch (e) {
          console.log(`Retry ${6 - retries}/5...`);
        }
        if (!inboxId && retries > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        retries--;
      }

      if (!inboxId) {
        alert('⚠️ Unable to find an inbox for this wallet address.\n\n' +
              'The user may not have connected to XMTP yet. Ask them to:\n' +
              '1. Connect their wallet to XMTP\n' +
              '2. Share their wallet address again');
        setIsAdding(false);
        return;
      }

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
    <div style={{ marginTop: '12px', padding: '12px', background: '#f5f7fb', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#1a202c' }}>➕ Add Member</div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Enter wallet address (0x...)"
          value={memberAddress}
          onChange={(e) => setMemberAddress(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleAddMember();
            }
          }}
          disabled={isAdding}
          style={{ flex: 1, padding: '8px 12px', fontSize: '13px', border: '1px solid #cbd5e0', borderRadius: '6px' }}
        />
        <button
          className="primary-action"
          onClick={handleAddMember}
          disabled={isAdding || !memberAddress.trim()}
          style={{ padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
        >
          {isAdding ? 'Adding...' : 'Add'}
        </button>
      </div>
      <div style={{ fontSize: '11px', color: '#718096', marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '4px' }}>
        <strong>Your wallet address:</strong>
        <div style={{ marginTop: '4px', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '10px' }}>
          {walletAddress || 'Not connected'}
        </div>
        <button
          onClick={() => {
            if (walletAddress) {
              navigator.clipboard.writeText(walletAddress);
              window.dispatchEvent(new CustomEvent('app-log', {
                detail: { message: '📋 Wallet address copied!', type: 'success' }
              }));
            }
          }}
          className="ghost-action tiny"
          style={{ marginTop: '4px', padding: '4px 8px', fontSize: '10px' }}
          disabled={!walletAddress}
        >
          📋 Copy Address
        </button>
      </div>
    </div>
  );
};

export default AddRoomMember;

