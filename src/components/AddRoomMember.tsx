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

    // Check if input is a wallet address (0x followed by 40 hex chars) or inbox ID
    const isWalletAddress = /^0x[a-fA-F0-9]{40}$/i.test(input);
    
    // Set adding state early
    setIsAdding(true);

    if (isWalletAddress) {
      // It's a wallet address - try to resolve to inbox ID
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `🔍 Looking up wallet address...`, type: 'info' }
      }));

      // Try to get inbox ID from address
      let retries = 5;
      
      while (retries > 0 && !inboxId) {
        try {
          inboxId = await XmtpService.getInstance().getInboxIdByAddress(input.toLowerCase());
          if (inboxId) {
            window.dispatchEvent(new CustomEvent('app-log', {
              detail: { message: `✅ Found inbox ID for address`, type: 'success' }
            }));
            break;
          }
        } catch (e: any) {
          const errorMsg = e?.message || String(e);
          // If method doesn't exist, don't retry
          if (errorMsg.includes('not a function') || errorMsg.includes('is not a function')) {
            console.error('getInboxIdByAddress method not available:', e);
            break; // Exit retry loop
          }
          console.log(`Retry ${6 - retries}/5...`, e);
        }
        if (!inboxId && retries > 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        retries--;
      }

      if (!inboxId) {
        // Try workaround: create a temporary DM to get inbox ID
        try {
          window.dispatchEvent(new CustomEvent('app-log', {
            detail: { message: `Trying alternative method to get inbox ID...`, type: 'info' }
          }));
          
          const client = useAppStore.getState().xmtpClient;
          if (client && (client as any).conversations) {
            const identifier = {
              identifier: input.toLowerCase(),
              identifierKind: 'Ethereum' as const
            };
            
            // Try to create DM with identifier to get inbox ID
            if ((client as any).conversations.newDm) {
              try {
                const tempDm = await (client as any).conversations.newDm(identifier);
                if (tempDm && tempDm.peerInboxId) {
                  inboxId = tempDm.peerInboxId;
                  window.dispatchEvent(new CustomEvent('app-log', {
                    detail: { message: `✅ Got inbox ID via DM creation`, type: 'success' }
                  }));
                }
              } catch (e) {
                console.log('DM creation workaround failed:', e);
              }
            }
          }
        } catch (e) {
          console.log('Workaround failed:', e);
        }
      }

      if (!inboxId) {
        // Provide helpful error message but don't exit - allow user to paste inbox ID
        const useInboxId = confirm('⚠️ Unable to resolve inbox ID from wallet address.\n\n' +
              'The user may not be registered on XMTP yet.\n\n' +
              'Would you like to:\n' +
              '• Click OK to ask them for their inbox ID\n' +
              '• Click Cancel to try again');
        
        if (useInboxId) {
          alert('Please ask the user to:\n' +
                '1. Connect their wallet to XMTP\n' +
                '2. Share their inbox ID with you\n' +
                '3. Paste it in the input field above');
        }
        setIsAdding(false);
        return;
      }
    } else {
      // Assume it's an inbox ID - use it directly
      inboxId = input;
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `Using inbox ID directly`, type: 'info' }
      }));
    }

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
    <div style={{ marginTop: '12px', padding: '12px', background: '#f5f7fb', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#1a202c' }}>➕ Add Member</div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Wallet address (0x...) or Inbox ID"
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
        <div style={{ marginBottom: '8px' }}>
          <strong>💡 Tip:</strong> You can enter either:
          <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px', fontSize: '10px' }}>
            <li>Wallet address (0x...) - will try to resolve to inbox ID</li>
            <li>Inbox ID directly - more reliable</li>
          </ul>
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
          <strong>Your wallet address:</strong>
          <div style={{ marginTop: '4px', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '10px' }}>
            {walletAddress || 'Not connected'}
          </div>
          {walletAddress && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(walletAddress);
                window.dispatchEvent(new CustomEvent('app-log', {
                  detail: { message: '📋 Wallet address copied!', type: 'success' }
                }));
              }}
              className="ghost-action tiny"
              style={{ marginTop: '4px', padding: '4px 8px', fontSize: '10px' }}
            >
              📋 Copy Address
            </button>
          )}
          {xmtpClient?.inboxId && (
            <>
              <div style={{ marginTop: '8px', fontSize: '10px' }}>
                <strong>Your inbox ID:</strong>
                <div style={{ marginTop: '4px', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '9px' }}>
                  {xmtpClient.inboxId}
                </div>
              </div>
              <button
                onClick={() => {
                  if (xmtpClient.inboxId) {
                    navigator.clipboard.writeText(xmtpClient.inboxId);
                    window.dispatchEvent(new CustomEvent('app-log', {
                      detail: { message: '📋 Inbox ID copied!', type: 'success' }
                    }));
                  }
                }}
                className="ghost-action tiny"
                style={{ marginTop: '4px', padding: '4px 8px', fontSize: '10px' }}
              >
                📋 Copy Inbox ID
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddRoomMember;

