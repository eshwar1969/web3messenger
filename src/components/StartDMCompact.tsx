'use client';

import React, { useState } from 'react';
import { useConversations } from '../hooks/useConversations';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';

const StartDMCompact: React.FC = () => {
  const [input, setInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const { createDM, loadConversations, selectConversation } = useConversations();
  const { xmtpClient } = useAppStore();

  const handleStartDM = async () => {
    if (!xmtpClient || !input.trim()) return;

    try {
      setIsCreating(true);
      let inboxId: string | null = null;
      const trimmedInput = input.trim().toLowerCase();

      // Check if it's an inbox ID or address
      const isAddress = /^0x[a-fA-F0-9]{40}$/i.test(trimmedInput);
      
      if (isAddress) {
        // Try to get inbox ID from address with retries (like main.js line 1278-1313)
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `🔍 Looking up ${trimmedInput}...`, type: 'info' }
        }));
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `⏳ This can take a while on the dev network...`, type: 'warning' }
        }));

        let retries = 5;
        while (retries > 0 && !inboxId) {
          try {
            inboxId = await XmtpService.getInstance().getInboxIdByAddress(trimmedInput);
            if (inboxId) {
              window.dispatchEvent(new CustomEvent('app-log', {
                detail: { message: `✅ Inbox ID found: ${inboxId.slice(0, 16)}...`, type: 'success' }
              }));
              break;
            }
          } catch (e: any) {
            window.dispatchEvent(new CustomEvent('app-log', {
              detail: { message: `⏳ Retry ${6 - retries}/5...`, type: 'info' }
            }));
          }

          if (!inboxId && retries > 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          retries--;
        }

        if (!inboxId) {
          window.dispatchEvent(new CustomEvent('app-log', {
            detail: { message: `❌ Unable to resolve inbox ID`, type: 'error' }
          }));
          alert('⚠️ Unable to locate an inbox for this address.\n\n' +
                '🔄 Try this:\n' +
                '1. Ask your contact for their inbox ID (visible after they connect)\n' +
                '2. Enter the full inbox ID instead\n' +
                '3. Click "Start DM"\n\n' +
                'This path is faster and more reliable on the dev network.');
          setIsCreating(false);
          return;
        }
      } else {
        // Use inbox ID directly (like main.js line 1265-1268) - RECOMMENDED METHOD
        inboxId = trimmedInput;
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `📬 Using inbox ID: ${inboxId.slice(0, 16)}...`, type: 'info' }
        }));
      }

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '💬 Creating DM conversation...', type: 'info' }
      }));

      // Create or get DM (like main.js line 1316-1328)
      // This works even if the user is offline - conversation is created locally
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
      
      // Wait a bit for conversations to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedConversations = useAppStore.getState().conversations;
      const idx = updatedConversations.findIndex((c: any) => c.peerInboxId === inboxId || c.id === dm?.id);
      if (idx !== -1) {
        selectConversation(idx);
        // Close the new chat panel after selecting
        window.dispatchEvent(new CustomEvent('close-new-chat'));
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

  return (
    <div style={{ marginBottom: '1rem' }}>
      <input
        type="text"
        placeholder="Enter inbox ID (recommended) or wallet address"
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
          padding: '0.625rem',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          fontSize: '0.875rem',
          marginBottom: '0.5rem'
        }}
      />
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontStyle: 'italic' }}>
        💡 Tip: Inbox ID is faster and more reliable on dev network
      </div>
      <button
        className="btn btn-primary"
        onClick={handleStartDM}
        disabled={!input.trim() || isCreating}
        style={{ width: '100%', padding: '0.625rem', fontSize: '0.875rem' }}
      >
        {isCreating ? 'Creating...' : 'Start DM'}
      </button>
    </div>
  );
};

export default StartDMCompact;

