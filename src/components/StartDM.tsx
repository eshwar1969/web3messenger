'use client';

import React, { useState } from 'react';
import { useConversations } from '../hooks/useConversations';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';
import { FormatUtils } from '../utils/format';

const StartDM: React.FC = () => {
  const [addressType, setAddressType] = useState<'address' | 'inboxId'>('inboxId');
  const [input, setInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [searchResult, setSearchResult] = useState<{ type: string; value: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { createDM, loadConversations, selectConversation } = useConversations();
  const { xmtpClient } = useAppStore();

  const validateInput = () => {
    if (!input.trim()) {
      return { valid: false, error: 'Please enter an address or inbox ID' };
    }

    if (addressType === 'address') {
      if (!/^0x[a-fA-F0-9]{40}$/i.test(input.trim())) {
        return { valid: false, error: 'Invalid Ethereum address format' };
      }
    }

    return { valid: true };
  };

  const handleSearch = async () => {
    const validation = validateInput();
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    setIsSearching(true);
    try {
      const trimmedInput = input.trim().toLowerCase();

      if (addressType === 'address') {
        // Validate it's a valid address
        setSearchResult({
          type: 'ethereum',
          value: trimmedInput
        });
      } else {
        // Try to validate inbox ID
        setSearchResult({
          type: 'inboxId',
          value: trimmedInput
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Error searching: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartDM = async () => {
    if (!xmtpClient) {
      alert('Please connect your wallet first');
      return;
    }

    if (!searchResult) {
      alert('Please search for a user first');
      return;
    }

    try {
      setIsCreating(true);

      let inboxId: string | null = null;

      if (searchResult.type === 'inboxId') {
        // Use inbox ID directly (like main.js line 1265-1268)
        inboxId = searchResult.value;
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `📬 Using inbox ID: ${inboxId.slice(0, 16)}...`, type: 'info' }
        }));
      } else {
        // Try to get inbox ID from address (like main.js line 1278-1313)
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `🔍 Looking up ${searchResult.value}...`, type: 'info' }
        }));
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `⏳ This can take a while on the dev network...`, type: 'warning' }
        }));

        // Try to get inbox ID from address with retries (like main.js - 5 retries)
        let retries = 5;
        while (retries > 0 && !inboxId) {
          try {
            inboxId = await XmtpService.getInstance().getInboxIdByAddress(searchResult.value);
            if (inboxId) {
              window.dispatchEvent(new CustomEvent('app-log', {
                detail: { message: `✅ Inbox ID found: ${inboxId.slice(0, 16)}...`, type: 'success' }
              }));
              break;
            }
          } catch (e: any) {
            const errorMsg = e?.message || String(e);
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
                '2. Switch the selector above to "Inbox ID"\n' +
                '3. Paste the full inbox ID\n' +
                '4. Click "Start Chat"\n\n' +
                'This path is faster and more reliable on the dev network.');
          setIsCreating(false);
          return;
        }
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

      // Clear inputs
      setInput('');
      setSearchResult(null);

      // Select the conversation
      await loadConversations();
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

  const handleReset = () => {
    setInput('');
    setSearchResult(null);
    setAddressType('inboxId');
  };

  return (
    <div className="dm-creation-panel">
      <h3>💬 Start a New Conversation</h3>

      <div className="dm-creation-form">
        {/* Search Type Toggle */}
        <div className="form-group">
          <label>Search by:</label>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="searchType"
                value="inboxId"
                checked={addressType === 'inboxId'}
                onChange={() => {
                  setAddressType('inboxId');
                  setInput('');
                  setSearchResult(null);
                }}
              />
              <span>Inbox ID</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="searchType"
                value="address"
                checked={addressType === 'address'}
                onChange={() => {
                  setAddressType('address');
                  setInput('');
                  setSearchResult(null);
                }}
              />
              <span>Ethereum Address</span>
            </label>
          </div>
        </div>

        {/* Search Input */}\n        <div className="form-group">
          <label>
            {addressType === 'inboxId' ? 'Inbox ID (e.g., peer.inbox.xyz)' : 'Ethereum Address (0x...)'}
          </label>
          <input
            type="text"
            placeholder={addressType === 'inboxId' ? 'peer.inbox.xyz' : '0x0000...0000'}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSearchResult(null);
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                handleSearch();
              }
            }}
            disabled={isSearching}
          />
        </div>

        {/* Search Results */}
        {searchResult && (
          <div className="search-results">
            <div className="search-result-item">
              <div className="search-result-info">
                <div className="search-result-label">
                  {searchResult.type === 'inboxId' ? '📮 Inbox ID' : '🔑 Ethereum Address'}
                </div>
                <div className="search-result-value">{searchResult.value}</div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="form-buttons">
          <button
            className="primary-btn"
            onClick={handleSearch}
            disabled={isSearching || !input.trim() || !!searchResult}
          >
            {isSearching ? '🔍 Searching...' : '🔍 Search'}
          </button>
          {searchResult && (
            <button
              className="primary-btn"
              onClick={handleStartDM}
              disabled={isCreating}
              style={{ background: '#25d366' }}
            >
              {isCreating ? '⏳ Creating...' : '✓ Start Chat'}
            </button>
          )}
          {searchResult && (
            <button
              className="secondary-btn"
              onClick={handleReset}
              disabled={isCreating}
            >
              Reset
            </button>
          )}
        </div>

        {/* Helper Text */}
        <div style={{
          fontSize: '0.85rem',
          color: '#667781',
          padding: '0.75rem',
          background: '#f0f2f5',
          borderRadius: '8px',
          lineHeight: '1.5'
        }}>
          <strong>💡 Tip:</strong> Inbox IDs are the fastest way to start a chat. Ask your contact for theirs from their profile!
        </div>
      </div>
    </div>
  );
};

export default StartDM;

