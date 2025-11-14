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
        inboxId = await XmtpService.getInstance().getInboxIdByAddress(trimmedInput);
        if (!inboxId) {
          alert('Address not found. Please use inbox ID or ensure the user is registered on XMTP.');
          setIsCreating(false);
          return;
        }
      } else {
        inboxId = trimmedInput;
      }

      const dm = await createDM(inboxId);
      await loadConversations();
      const updatedConversations = useAppStore.getState().conversations;
      const idx = updatedConversations.findIndex((c: any) => c.id === dm?.id);
      if (idx !== -1) {
        selectConversation(idx);
      }
      setInput('');
    } catch (error) {
      console.error('Error creating DM:', error);
      alert('Failed to create conversation');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ marginBottom: '1rem' }}>
      <input
        type="text"
        placeholder="Enter wallet address or inbox ID"
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

