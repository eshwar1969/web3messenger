'use client';

import React, { useState } from 'react';
import { PrivateXmtpService } from '../services/private-xmtp.service';
import { FormatUtils } from '../utils/format';

interface AddChannelMemberProps {
  conversation: any;
  onMemberAdded?: () => void;
}

const AddChannelMember: React.FC<AddChannelMemberProps> = ({ conversation, onMemberAdded }) => {
  const [memberInput, setMemberInput] = useState('');
  const [inputType, setInputType] = useState<'address' | 'inboxId'>('address');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const privateXmtpService = PrivateXmtpService.getInstance();

  const handleAddMember = async () => {
    if (!conversation) {
      setError('No conversation selected');
      return;
    }

    if (!memberInput.trim()) {
      setError(`Please enter a ${inputType === 'address' ? 'wallet address' : 'inbox ID'}`);
      return;
    }

    const input = memberInput.trim();

    setIsAdding(true);
    setError(null);

    try {
      const client = privateXmtpService.getClient();
      if (!client) {
        throw new Error('XMTP client not initialized');
      }

      let inboxId: string | null = null;

      if (inputType === 'inboxId') {
        // If user selected inbox ID, use it directly
        inboxId = input;
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `📬 Using inbox ID directly...`, type: 'info' }
        }));
      } else {
        // Wallet address - validate format first
        const normalizedAddress = input.toLowerCase();
        if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedAddress)) {
          throw new Error('Invalid wallet address format. Please enter a valid Ethereum address (0x...).');
        }

        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `🔍 Resolving wallet address to inbox ID...`, type: 'info' }
        }));

        // Try to get inbox ID from wallet address
        // Method 1: Try using address directly (XMTP V3 supports this)
        // This is the most reliable method for private networks
        try {
          // In XMTP V3, you can often use wallet addresses directly as identifiers
          // Try creating a group with the address - if it works, we can use it
          const testGroup = await (client as any).conversations?.newGroup?.([normalizedAddress]);
          if (testGroup) {
            inboxId = normalizedAddress;
            window.dispatchEvent(new CustomEvent('app-log', {
              detail: { message: `✅ Resolved wallet address`, type: 'success' }
            }));
          }
        } catch (e: any) {
          console.log('Direct address method failed:', e);
          
          // If that fails, try to get inbox ID via API (may not work in private network)
          try {
            if ((client as any).getInboxIdByAddress && typeof (client as any).getInboxIdByAddress === 'function') {
              inboxId = await (client as any).getInboxIdByAddress(normalizedAddress);
            }
          } catch (apiError) {
            console.log('API method failed:', apiError);
          }
        }

        // If still no inbox ID, use address directly (fallback)
        if (!inboxId) {
          console.log('Using wallet address directly as identifier');
          inboxId = normalizedAddress;
        }
      }

      if (!inboxId) {
        throw new Error('Unable to resolve identifier. Please try using inbox ID instead.');
      }

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `➕ Adding member to channel...`, type: 'info' }
      }));

      // Add member to the group conversation
      if (conversation.addMembers) {
        await conversation.addMembers([inboxId]);
      } else if (conversation.add) {
        await conversation.add([inboxId]);
      } else {
        throw new Error('Cannot add members to this conversation');
      }

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `✅ Member added to channel!`, type: 'success' }
      }));

      setMemberInput('');
      setError(null);

      // Sync the conversation to get updated member list
      try {
        await conversation.sync();
      } catch (e) {
        console.log('Sync error (non-critical):', e);
      }

      if (onMemberAdded) {
        onMemberAdded();
      }

      alert('Member added successfully!');
    } catch (err: any) {
      console.error('Error adding member:', err);
      const errorMessage = err.message || 'Failed to add member';
      setError(errorMessage);
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `❌ ${errorMessage}`, type: 'error' }
      }));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div style={{ 
      padding: '1rem', 
      background: 'rgba(26, 26, 26, 0.4)', 
      borderRadius: '8px',
      border: '1px solid var(--border-color)'
    }}>
      <div style={{ 
        fontSize: '0.875rem', 
        fontWeight: '600', 
        marginBottom: '0.75rem',
        color: 'var(--text-primary)'
      }}>
        ➕ Add Member to Channel
      </div>

      {/* Input Type Selector */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '0.75rem',
        background: 'rgba(26, 26, 26, 0.3)',
        padding: '0.25rem',
        borderRadius: '8px'
      }}>
        <button
          onClick={() => {
            setInputType('address');
            setMemberInput('');
            setError(null);
          }}
          style={{
            flex: 1,
            padding: '0.5rem',
            background: inputType === 'address' ? 'var(--gradient-primary)' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Wallet Address
        </button>
        <button
          onClick={() => {
            setInputType('inboxId');
            setMemberInput('');
            setError(null);
          }}
          style={{
            flex: 1,
            padding: '0.5rem',
            background: inputType === 'inboxId' ? 'var(--gradient-primary)' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            fontSize: '0.75rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Inbox ID
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={memberInput}
            onChange={(e) => {
              setMemberInput(e.target.value);
              setError(null);
            }}
            placeholder={inputType === 'address' ? 'Enter wallet address (0x...)' : 'Enter inbox ID (e.g., peer.inbox.xyz)'}
            disabled={isAdding}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(26, 26, 26, 0.5)',
              border: error ? '1px solid #dc2626' : '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isAdding && memberInput.trim()) {
                handleAddMember();
              }
            }}
          />
          {error && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '6px',
              color: '#fca5a5',
              fontSize: '0.75rem'
            }}>
              {error}
            </div>
          )}
          <div style={{
            marginTop: '0.5rem',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            lineHeight: '1.4'
          }}>
            💡 {inputType === 'address' 
              ? 'Enter the wallet address (0x...). If resolution fails, try using Inbox ID instead.'
              : 'Enter the inbox ID directly. This is more reliable if wallet address resolution fails.'}
          </div>
        </div>
        <button
          onClick={handleAddMember}
          disabled={!memberInput.trim() || isAdding}
          style={{
            padding: '0.75rem 1.5rem',
            background: isAdding || !memberInput.trim()
              ? 'rgba(59, 130, 246, 0.3)'
              : 'var(--gradient-primary)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '600',
            cursor: isAdding || !memberInput.trim() ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            whiteSpace: 'nowrap',
            opacity: isAdding || !memberInput.trim() ? 0.6 : 1
          }}
        >
          {isAdding ? 'Adding...' : 'Add'}
        </button>
      </div>
    </div>
  );
};

export default AddChannelMember;

