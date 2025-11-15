'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';
import { PrivateXmtpService } from '../services/private-xmtp.service';
import { NftVerificationService, TokenGate } from '../services/nft-verification.service';
import { WalkieTalkieService } from '../services/walkie-talkie.service';
import { FormatUtils } from '../utils/format';
import WalkieTalkieButton from '../components/WalkieTalkieButton';
import AddChannelMember from '../components/AddChannelMember';
import { useAppStore } from '../store/useAppStore';

const GovChatPage: React.FC = () => {
  const router = useRouter();
  const { setXmtpClient, setWalletAddress } = useAppStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversation, setCurrentConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [tokenGateContract, setTokenGateContract] = useState('');
  const [tokenGateTokenIds, setTokenGateTokenIds] = useState('');
  const [userRank, setUserRank] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef<boolean>(false);
  const privateXmtpService = PrivateXmtpService.getInstance();
  const nftService = NftVerificationService.getInstance();
  const wtService = WalkieTalkieService.getInstance();

  // Check authentication on mount
  useEffect(() => {
    // Prevent multiple initializations
    if (initializationRef.current) {
      return;
    }

    const auth = localStorage.getItem('gov_portal_auth');
    if (!auth) {
      router.push('/gov-portal');
      return;
    }

    initializationRef.current = true;
    initializeGovPortal();
  }, []);

  const initializeGovPortal = async () => {
    try {
      const auth = JSON.parse(localStorage.getItem('gov_portal_auth') || '{}');
      
      // Check if it's dev mode or hardware wallet auth
      if ((auth.authType === 'hardware' || auth.authType === 'dev') && auth.address) {
        // Initialize with wallet (hardware or dev mode)
        if (typeof window.ethereum === 'undefined') {
          throw new Error('Wallet not available');
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();

        // Verify address matches auth (for security)
        if (address.toLowerCase() !== auth.address.toLowerCase()) {
          throw new Error('Wallet address mismatch. Please reconnect.');
        }

        // Set provider for NFT verification
        nftService.setProvider(provider);

        // Initialize private XMTP client
        // The service now handles retries internally
        const client = await privateXmtpService.initializeClient(signer, { env: 'dev' });
        
        setXmtpClient(client);
        setWalletAddress(address);

        // Load conversations
        await loadConversations(client);

        // Get user rank from NFT (optional for dev mode)
        // In production, this would check a specific rank NFT contract
        // const rank = await nftService.getUserRank(address, RANK_NFT_CONTRACT);
        // setUserRank(rank);

        // For dev mode, set a default rank
        if (auth.isDevMode) {
          setUserRank('Developer');
        }

        setIsInitialized(true);
      } else if (auth.authType === 'whitelist') {
        // For whitelist auth, we'd need to get wallet address differently
        // This is a simplified version
        setError('Whitelist authentication requires wallet connection');
      } else {
        throw new Error('Invalid authentication. Please authenticate again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize government portal');
      console.error('Gov portal initialization error:', err);
    }
  };

  const loadConversations = async (client: any) => {
    try {
      const convs = await client.conversations.list();
      setConversations(convs);
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  };

  const handleCreateTokenGatedChannel = async () => {
    // In dev mode, allow creating channels without token gates
    const auth = JSON.parse(localStorage.getItem('gov_portal_auth') || '{}');
    const isDevMode = auth.isDevMode === true;
    
    if (!channelName) {
      setError('Channel name is required');
      return;
    }
    
    if (!tokenGateContract && !isDevMode) {
      setError('NFT Contract Address is required (or use dev mode to create open channels)');
      return;
    }

    try {
      const client = privateXmtpService.getClient();
      if (!client) {
        throw new Error('XMTP client not initialized');
      }

      let tokenGate: TokenGate | undefined = undefined;
      
      if (tokenGateContract) {
        // Parse token IDs if provided
        const tokenIds = tokenGateTokenIds
          ? tokenGateTokenIds.split(',').map(id => id.trim())
          : undefined;

        // Create token gate
        tokenGate = {
          contractAddress: tokenGateContract,
          tokenIds: tokenIds,
        };
      } else if (isDevMode) {
        console.log('DEV MODE: Creating channel without token gate');
      }

      // Create group conversation
      const group = await client.conversations.newGroup([]);
      
      // Store token gate info with conversation
      const channelInfo = {
        name: channelName,
        tokenGate,
        conversationId: group.id,
        createdAt: Date.now()
      };

      // Store in localStorage (in production, would be on server)
      const channels = JSON.parse(localStorage.getItem('gov_channels') || '[]');
      channels.push(channelInfo);
      localStorage.setItem('gov_channels', JSON.stringify(channels));

      // Send channel info as first message
      if (tokenGate) {
        await group.send(JSON.stringify({
          type: 'channel_info',
          name: channelName,
          tokenGate
        }));
      } else {
        await group.send(JSON.stringify({
          type: 'channel_info',
          name: channelName,
          message: 'Open channel (no token gate required)'
        }));
      }

      setShowCreateChannel(false);
      setChannelName('');
      setTokenGateContract('');
      setTokenGateTokenIds('');
      await loadConversations(client);
      setCurrentConversation(group);
    } catch (err: any) {
      console.error('Error creating channel:', err);
      setError(err.message || 'Failed to create channel');
    }
  };

  const handleJoinChannel = async (conversation: any) => {
    try {
      setError(null);
      // Check if channel has token gate
      const channels = JSON.parse(localStorage.getItem('gov_channels') || '[]');
      const channelInfo = channels.find((c: any) => c.conversationId === conversation.id);

      if (channelInfo && channelInfo.tokenGate) {
        const walletAddress = useAppStore.getState().walletAddress;
        if (!walletAddress) {
          throw new Error('Wallet not connected');
        }

        // Check if in dev mode - allow bypass for testing
        const auth = JSON.parse(localStorage.getItem('gov_portal_auth') || '{}');
        const isDevMode = auth.isDevMode === true;

        if (!isDevMode) {
          // Verify token gate
          const hasAccess = await nftService.verifyTokenGate(walletAddress, channelInfo.tokenGate);
          
          if (!hasAccess) {
            const tokenGateInfo = channelInfo.tokenGate.tokenIds && channelInfo.tokenGate.tokenIds.length > 0
              ? `Token IDs: ${channelInfo.tokenGate.tokenIds.join(', ')}`
              : 'Any token from this contract';
            
            setError(`Access denied: You do not hold the required NFT for this channel.\n\nRequired: ${channelInfo.tokenGate.contractAddress}\n${tokenGateInfo}`);
            return;
          }
        } else {
          // In dev mode, log a warning but allow access
          console.warn('DEV MODE: Bypassing token gate verification', {
            contract: channelInfo.tokenGate.contractAddress,
            tokenIds: channelInfo.tokenGate.tokenIds
          });
        }
      }

      setCurrentConversation(conversation);
      await loadMessages(conversation);
    } catch (err: any) {
      console.error('Error joining channel:', err);
      setError(err.message || 'Failed to join channel');
    }
  };

  const loadMessages = async (conversation: any) => {
    try {
      await conversation.sync();
      const msgs = await conversation.messages();
      setMessages(msgs);
      scrollToBottom();
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  // Reload messages after sending push-to-talk
  useEffect(() => {
    if (!currentConversation) return;
    
    // Listen for custom event when PTT message is sent
    const handlePTTSent = () => {
      loadMessages(currentConversation);
    };
    
    window.addEventListener('ptt-message-sent', handlePTTSent);
    return () => window.removeEventListener('ptt-message-sent', handlePTTSent);
  }, [currentConversation]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !currentConversation || isSending) return;

    try {
      setIsSending(true);
      await currentConversation.send(messageInput);
      setMessageInput('');
      await loadMessages(currentConversation);
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Stream messages and handle walkie-talkie messages
  useEffect(() => {
    if (!currentConversation || !useAppStore.getState().xmtpClient) return;

    const streamMessages = async () => {
      try {
        console.log('Listening for new messages...');
        const stream = await currentConversation.stream();
        
        for await (const message of stream) {
          console.log('New message received!');
          
          // Check if it's a walkie-talkie message
          try {
            const data = typeof message.content === 'string' 
              ? JSON.parse(message.content) 
              : message.content;
            
            if (data && typeof data === 'object' && data.type && data.type.startsWith('walkie_talkie_')) {
              // Handle walkie-talkie WebRTC signaling
              await wtService.handleMessage(message);
              // Don't add walkie-talkie signaling messages to chat
              continue;
            }
          } catch (e) {
            // Not a walkie-talkie message, continue
          }
          
          setMessages(prev => {
            // Deduplicate
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          });
          scrollToBottom();
        }
      } catch (err) {
        console.error('Error streaming messages:', err);
      }
    };

    streamMessages();
  }, [currentConversation]);

  if (!isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: 'var(--gradient-background)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🛡️</div>
          <div>Initializing secure connection...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="messenger-app">
      {/* Sidebar */}
      <div className="messenger-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-left">
            <div style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '600'
            }}>
              🛡️
            </div>
            <div>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Gov Portal</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {userRank || 'Private Network'}
                {JSON.parse(localStorage.getItem('gov_portal_auth') || '{}').isDevMode && (
                  <span style={{ 
                    marginLeft: '0.5rem', 
                    padding: '0.125rem 0.375rem', 
                    background: 'rgba(251, 191, 36, 0.2)', 
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    color: '#fbbf24'
                  }}>
                    DEV
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('gov_portal_auth');
              router.push('/');
            }}
            className="icon-btn"
            title="Logout"
          >
            🚪
          </button>
        </div>

        <div style={{ padding: '1rem' }}>
          <button
            onClick={() => setShowCreateChannel(true)}
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '1rem' }}
          >
            ➕ Create Token-Gated Channel
          </button>

          {error && (
            <div style={{
              padding: '0.75rem',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '8px',
              marginBottom: '1rem',
              color: '#fca5a5',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
            Channels
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {conversations.map((conv, index) => (
              <div
                key={index}
                onClick={() => handleJoinChannel(conv)}
                className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
              >
                <div className="conversation-avatar">📡</div>
                <div className="conversation-info">
                  <div className="conversation-name">
                    {conv.version === 'DM' ? 'Direct Message' : 'Channel'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="messenger-chat">
        {currentConversation ? (
          <>
            <div className="chat-header">
              <div className="chat-header-left">
                <div className="conversation-avatar">📡</div>
                <div className="chat-header-info">
                  <h2>Secure Channel</h2>
                  <p>Private Network • End-to-End Encrypted</p>
                </div>
              </div>
            </div>

            {/* Add Member Section */}
            <div style={{ padding: '0.75rem 1rem', background: 'var(--background-light)', borderBottom: '1px solid var(--border-color)' }}>
              <AddChannelMember 
                conversation={currentConversation}
                onMemberAdded={async () => {
                  // Reload conversations to update member list
                  const client = privateXmtpService.getClient();
                  if (client) {
                    await loadConversations(client);
                  }
                  // Sync current conversation
                  try {
                    await currentConversation.sync();
                  } catch (e) {
                    console.log('Sync error (non-critical):', e);
                  }
                  
                  // Refresh walkie-talkie service with updated member list
                  // This ensures new members can hear broadcasts and can broadcast themselves
                  try {
                    const xmtpClient = useAppStore.getState().xmtpClient;
                    if (xmtpClient && currentConversation) {
                      // Refresh members in the walkie-talkie service
                      await wtService.refreshMembers();
                      console.log('Walkie-talkie service refreshed with updated members');
                    }
                  } catch (e) {
                    console.log('Walkie-talkie refresh error (non-critical):', e);
                  }
                }}
              />
            </div>

            <div className="chat-messages">
              {messages
                .filter((message) => {
                  // Filter out system messages and non-string content
                  // System messages have object content with keys like initiatedByInboxId, addedInboxes, etc.
                  if (!message.content || typeof message.content !== 'string') {
                    return false; // Don't render system messages
                  }
                  return true;
                })
                .map((message, index) => {
                  const isSent = message.senderInboxId === useAppStore.getState().xmtpClient?.inboxId;
                  const senderName = isSent ? 'YOU' : 'PEER';
                  
                  // Check if it's a push-to-talk or voice message
                  try {
                    const parsed = JSON.parse(message.content);
                    
                    // Handle attachments (voice messages and push-to-talk)
                    if (parsed.type === 'attachment' && parsed.attachment) {
                      const attachment = parsed.attachment;
                      const audioUrl = `data:${attachment.mimeType};base64,${attachment.data}`;
                      
                      // Check if it's an audio attachment
                      if (attachment.type === 'voice_message' || attachment.mimeType?.startsWith('audio/')) {
                        return (
                          <div key={index} className={`message ${isSent ? 'sent' : 'received'}`}>
                            <div className="message-bubble">
                              <div className="message-header">
                                <span>{senderName}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <audio controls src={audioUrl} style={{ maxWidth: '200px' }} />
                                <span style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                                  📻 Push-to-Talk
                                </span>
                              </div>
                              <div className="message-time">
                                {FormatUtils.getInstance().formatMessageTime(message.sentAtNs)}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    }
                    
                    // Handle channel info messages
                    if (parsed.type === 'channel_info') {
                      return null; // Don't render channel info messages
                    }
                  } catch (e) {
                    // Not JSON, continue to render as regular message
                  }

                  // Regular text message
                  return (
                    <div key={index} className={`message ${isSent ? 'sent' : 'received'}`}>
                      <div className="message-bubble">
                        <div className="message-header">
                          <span>{senderName}</span>
                        </div>
                        <div className="message-content">
                          {typeof message.content === 'string' 
                            ? FormatUtils.getInstance().escapeHtml(message.content)
                            : 'System message'}
                        </div>
                        <div className="message-time">
                          {FormatUtils.getInstance().formatMessageTime(message.sentAtNs)}
                        </div>
                      </div>
                    </div>
                  );
                })
                .filter(msg => msg !== null) // Remove null returns
              }
              <div ref={messagesEndRef} />
            </div>

            {/* Real-time Walkie-Talkie Button */}
            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <WalkieTalkieButton 
                conversation={currentConversation} 
                xmtpClient={useAppStore.getState().xmtpClient}
              />
              <div style={{
                marginTop: '0.75rem',
                padding: '0.5rem',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '6px',
                fontSize: '0.7rem',
                color: '#93c5fd',
                textAlign: 'center'
              }}>
                📻 Real-time walkie-talkie: All channel members will hear when you push to talk
              </div>
            </div>

            {/* Message Input */}
            <form className="chat-input-container" onSubmit={handleSendMessage}>
              <div className="chat-input-wrapper">
                <textarea
                  className="chat-input"
                  placeholder="Type a secure message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  rows={1}
                  disabled={isSending}
                />
              </div>
              <button
                type="submit"
                className="send-btn"
                disabled={!messageInput.trim() || isSending}
              >
                ➤
              </button>
            </form>
          </>
        ) : (
          <div className="empty-chat">
            <div className="empty-chat-icon">🛡️</div>
            <h3>Select a Channel</h3>
            <p>Choose a channel from the sidebar or create a new token-gated channel</p>
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowCreateChannel(false)}
        >
          <div
            style={{
              background: 'rgba(26, 26, 26, 0.95)',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%',
              border: '1px solid var(--border-color)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '600' }}>
              Create Token-Gated Channel
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Channel Name
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="e.g., Officers Channel"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(26, 26, 26, 0.5)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  NFT Contract Address {JSON.parse(localStorage.getItem('gov_portal_auth') || '{}').isDevMode ? '(Optional in Dev Mode)' : '(Required)'}
                </label>
                <input
                  type="text"
                  value={tokenGateContract}
                  onChange={(e) => setTokenGateContract(e.target.value)}
                  placeholder="0x... (leave empty for open channel in dev mode)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(26, 26, 26, 0.5)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace'
                  }}
                />
                {JSON.parse(localStorage.getItem('gov_portal_auth') || '{}').isDevMode && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    💡 In dev mode, you can create open channels without token gates for testing
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Token IDs (Optional, comma-separated)
                </label>
                <input
                  type="text"
                  value={tokenGateTokenIds}
                  onChange={(e) => setTokenGateTokenIds(e.target.value)}
                  placeholder="1, 2, 3 or leave empty for any token"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(26, 26, 26, 0.5)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowCreateChannel(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTokenGatedChannel}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Create Channel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GovChatPage;

