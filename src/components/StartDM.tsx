'use client';

import React, { useState } from 'react';
import { useConversations } from '../hooks/useConversations';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';

const StartDM: React.FC = () => {
  const [addressType, setAddressType] = useState<'address' | 'inboxId'>('address');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientInboxId, setRecipientInboxId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { createDM, loadConversations, selectConversation } = useConversations();
  const { xmtpClient } = useAppStore();

  const handleStartDM = async () => {
    if (!xmtpClient) {
      alert('Please connect your wallet first');
      return;
    }

    const input = addressType === 'inboxId' ? recipientInboxId.trim().toLowerCase() : recipientAddress.trim().toLowerCase();
    
    if (!input) {
      alert('Please enter an Ethereum address or inbox ID.');
      return;
    }

    try {
      setIsCreating(true);

      let inboxId: string | null = null;

      if (addressType === 'inboxId') {
        inboxId = input;
      } else {
        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/i.test(input)) {
          alert('Invalid address. Please use a valid Ethereum address (0x...).');
          setIsCreating(false);
          return;
        }

        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `🔍 Looking up wallet address...`, type: 'info' }
        }));

        // Try to get inbox ID from address
        let retries = 5;
        while (retries > 0 && !inboxId) {
          try {
            inboxId = await XmtpService.getInstance().getInboxIdByAddress(input);
            if (inboxId) {
              window.dispatchEvent(new CustomEvent('app-log', {
                detail: { message: `✅ Found inbox ID for address`, type: 'success' }
              }));
              break;
            }
          } catch (e: any) {
            const errorMsg = e?.message || String(e);
            // If method doesn't exist, try workaround
            if (errorMsg.includes('not a function') || errorMsg.includes('is not a function')) {
              console.error('getInboxIdByAddress method not available, trying workaround:', e);
              break; // Exit retry loop to try workaround
            }
            console.log(`Retry ${6 - retries}/5...`);
          }
          if (!inboxId && retries > 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          retries--;
        }

        // Workaround: Try creating DM directly with identifier if getInboxIdByAddress failed
        if (!inboxId && xmtpClient) {
          try {
            window.dispatchEvent(new CustomEvent('app-log', {
              detail: { message: `Trying alternative method...`, type: 'info' }
            }));
            
            const identifier = {
              identifier: input.toLowerCase(),
              identifierKind: 'Ethereum' as const
            };
            
            // Try to create DM with identifier directly
            if ((xmtpClient as any).conversations?.newDm) {
              try {
                const tempDm = await (xmtpClient as any).conversations.newDm(identifier);
                if (tempDm && tempDm.peerInboxId) {
                  inboxId = tempDm.peerInboxId;
                  window.dispatchEvent(new CustomEvent('app-log', {
                    detail: { message: `✅ Got inbox ID via DM creation`, type: 'success' }
                  }));
                } else if (tempDm) {
                  // If DM was created but no peerInboxId, try to get it from the conversation
                  // In XMTP V3, a DM created with identifier should work
                  // We can use the DM directly
                  window.dispatchEvent(new CustomEvent('app-log', {
                    detail: { message: `✅ DM created with address`, type: 'success' }
                  }));
                  
                  // Clear inputs
                  setRecipientAddress('');
                  setRecipientInboxId('');
                  
                  // Select the conversation
                  await loadConversations();
                  const updatedConversations = useAppStore.getState().conversations;
                  const idx = updatedConversations.findIndex((c: any) => c.id === tempDm.id);
                  if (idx !== -1) {
                    selectConversation(idx);
                  }
                  
                  setIsCreating(false);
                  return;
                }
              } catch (e: any) {
                const errorMsg = e?.message || String(e);
                if (errorMsg.includes('not registered') || errorMsg.includes('not found')) {
                  window.dispatchEvent(new CustomEvent('app-log', {
                    detail: { message: `Address not registered on XMTP`, type: 'warning' }
                  }));
                }
              }
            }
          } catch (e) {
            console.log('Workaround failed:', e);
          }
        }

        if (!inboxId) {
          alert('⚠️ Unable to locate an inbox for this address.\n\n' +
                'The user may not be registered on XMTP yet.\n\n' +
                '🔄 Try this:\n' +
                '1. Ask your contact to connect their wallet to XMTP first\n' +
                '2. Ask them for their inbox ID (visible after they connect)\n' +
                '3. Switch the selector above to "Inbox ID"\n' +
                '4. Paste the full inbox ID\n' +
                '5. Click "Start DM"\n\n' +
                'Using inbox ID is faster and more reliable.');
          setIsCreating(false);
          return;
        }
      }

      // Dispatch log event
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '💬 Creating DM conversation...', type: 'info' }
      }));
      
      // Create or get DM
      const dm = await createDM(inboxId);
      
      // Dispatch success log
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '✅ DM conversation ready!', type: 'success' }
      }));
      
      // Clear inputs
      setRecipientAddress('');
      setRecipientInboxId('');

      // Select the conversation
      await loadConversations();
      // Get updated conversations from store
      const updatedConversations = useAppStore.getState().conversations;
      const idx = updatedConversations.findIndex((c: any) => c.peerInboxId === inboxId || c.id === dm?.id);
      if (idx !== -1) {
        selectConversation(idx);
      }

    } catch (error) {
      console.error('Error creating DM:', error);
      alert('Unable to create conversation: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="card-header">
        <h2>Start a DM</h2>
        <span className="card-subtitle">Search by wallet or inbox ID</span>
      </div>

      <label className="input-label">
        <input
          type="radio"
          name="addressType"
          value="address"
          checked={addressType === 'address'}
          onChange={() => setAddressType('address')}
        />
        Ethereum address (0x…)
      </label>
      <input
        type="text"
        id="recipientAddress"
        placeholder="0x0000..."
        value={recipientAddress}
        onChange={(e) => setRecipientAddress(e.target.value)}
        disabled={addressType !== 'address'}
      />

      <label className="input-label">
        <input
          type="radio"
          name="addressType"
          value="inboxId"
          checked={addressType === 'inboxId'}
          onChange={() => setAddressType('inboxId')}
        />
        Inbox ID (recommended on devnet)
      </label>
      <input
        type="text"
        id="recipientInboxId"
        placeholder="peer.inbox.xyz"
        value={recipientInboxId}
        onChange={(e) => setRecipientInboxId(e.target.value)}
        disabled={addressType !== 'inboxId'}
      />

      <button
        id="startDmBtn"
        className="secondary-action"
        onClick={handleStartDM}
        disabled={isCreating}
      >
        {isCreating ? 'Creating...' : 'Start DM'}
      </button>

      <div className="info-box subtle">
        🔍 Tip: Share your inbox ID with teammates for the fastest connection.
      </div>
    </>
  );
};

export default StartDM;

