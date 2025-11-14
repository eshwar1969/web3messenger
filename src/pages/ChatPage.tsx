'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useXmtp } from '../hooks/useXmtp';
import { useConversations } from '../hooks/useConversations';
import { useMessages } from '../hooks/useMessages';
import { useAppStore } from '../store/useAppStore';
import { FormatUtils } from '../utils/format';
import { ConversationService } from '../services/conversation.service';
import { FileService } from '../services/file.service';
import { WebRTCService } from '../services/webrtc.service';
import { useCallHandler } from '../hooks/useCallHandler';
import CallControls from '../components/CallControls';
import StartDMCompact from '../components/StartDMCompact';

const ChatPage: React.FC = () => {
  const router = useRouter();
  const { isConnected } = useXmtp();
  const { conversations, currentConversation, selectConversation, isLoading } = useConversations();
  const { messages, sendMessage } = useMessages();
  const { userProfile, xmtpClient, walletAddress } = useAppStore();
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle calls
  useCallHandler();

  // Redirect if not connected
  useEffect(() => {
    if (!isConnected) {
      router.push('/connect');
    }
  }, [isConnected, router]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation names
  const [conversationNames, setConversationNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const names = ConversationService.getInstance().getAllNames();
    setConversationNames(names);
  }, [conversations]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isSending) return;

    try {
      setIsSending(true);
      await sendMessage(messageInput.trim());
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsSending(true);
        await FileService.getInstance().handleFileUpload(file);
      } catch (error) {
        console.error('Failed to send file:', error);
        alert('Failed to send file');
      } finally {
        setIsSending(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const getConversationDisplayName = (conv: any) => {
    if (!conv) return 'Unknown';
    const customName = ConversationService.getInstance().getConversationName(conv.id);
    if (customName) return customName;
    
    if (conv.version === 'DM' && conv.peerInboxId) {
      return FormatUtils.getInstance().formatInboxId(conv.peerInboxId);
    }
    return `Room (${conv.memberInboxIds?.length || 0} members)`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredConversations = conversations.filter((conv: any) => {
    if (!searchQuery) return true;
    const name = getConversationDisplayName(conv);
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!isConnected) {
    return null;
  }

  return (
    <div className="messenger-app">
      {/* Sidebar */}
      <div className="messenger-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-header-left">
            <div className="user-avatar">
              {userProfile.profilePicture ? (
                <img src={userProfile.profilePicture} alt="Profile" />
              ) : (
                getInitials(userProfile.username || walletAddress || 'U')
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                {userProfile.username || 'You'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
              </div>
            </div>
          </div>
          <div className="sidebar-header-actions">
            <button className="icon-btn" onClick={() => setShowNewChat(!showNewChat)} title="New Chat">
              💬
            </button>
            <button className="icon-btn" onClick={() => router.push('/connect')} title="Settings">
              ⚙️
            </button>
          </div>
        </div>

        {showNewChat && (
          <div style={{ padding: '1rem', background: 'var(--background-light)', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '0.75rem' }}>New Chat</h3>
            <StartDMCompact />
            <button 
              className="btn btn-secondary" 
              onClick={() => setShowNewChat(false)}
              style={{ marginTop: '0.5rem', width: '100%', padding: '0.625rem', fontSize: '0.875rem' }}
            >
              Close
            </button>
          </div>
        )}

        <div className="search-container">
          <div className="search-box">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search or start new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="conversations-list">
          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="empty-chat">
              <div className="empty-chat-icon">💬</div>
              <h3>No conversations</h3>
              <p>Start a new chat to begin messaging</p>
            </div>
          ) : (
            filteredConversations.map((conv: any, index: number) => {
              const isActive = currentConversation?.id === conv.id;
              const displayName = getConversationDisplayName(conv);
              // Get last message for this specific conversation
              const lastMessage = isActive && messages.length > 0 
                ? messages[messages.length - 1] 
                : null;
              
              return (
                <div
                  key={conv.id || index}
                  className={`conversation-item ${isActive ? 'active' : ''}`}
                  onClick={() => selectConversation(index)}
                >
                  <div className="conversation-avatar">
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="conversation-info">
                    <div className="conversation-header">
                      <div className="conversation-name">{displayName}</div>
                      {lastMessage && (
                        <div className="conversation-time">
                          {FormatUtils.getInstance().formatMessageTime(lastMessage.sentAtNs)}
                        </div>
                      )}
                    </div>
                    <div className="conversation-preview">
                      {lastMessage ? (
                        typeof lastMessage.content === 'string' ? (
                          lastMessage.content.slice(0, 50)
                        ) : (
                          '📎 Attachment'
                        )
                      ) : (
                        'No messages yet'
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="messenger-chat">
        {!currentConversation ? (
          <div className="empty-chat">
            <div className="empty-chat-icon">💬</div>
            <h3>Select a conversation</h3>
            <p>Choose a chat from the sidebar to start messaging</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="chat-header-left">
                <div className="user-avatar">
                  {getInitials(getConversationDisplayName(currentConversation))}
                </div>
                <div className="chat-header-info">
                  <h2>{getConversationDisplayName(currentConversation)}</h2>
                  <p>
                    {currentConversation.version === 'DM' 
                      ? 'Direct message' 
                      : `${currentConversation.memberInboxIds?.length || 0} members`}
                  </p>
                </div>
              </div>
              <div className="chat-header-actions">
                {currentConversation.version !== 'DM' && (
                  <button 
                    className="icon-btn" 
                    title="Add member"
                    onClick={() => {
                      const address = prompt('Enter wallet address or inbox ID to add:');
                      if (address) {
                        // Simple add member - could be enhanced later
                        alert('Add member feature - use the AddRoomMember component in sidebar');
                      }
                    }}
                  >
                    ➕
                  </button>
                )}
                <button className="icon-btn" title="Voice call">📞</button>
                <button className="icon-btn" title="Video call">📹</button>
                <button className="icon-btn" title="More options">⋯</button>
              </div>
            </div>

            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <div className="empty-chat-icon">💬</div>
                  <h3>No messages yet</h3>
                  <p>Start the conversation by sending a message</p>
                </div>
              ) : (
                messages.map((message: any, index: number) => {
                  const isSent = message.senderInboxId === xmtpClient?.inboxId;
                  
                  // Handle system messages
                  if (!message.content || typeof message.content !== 'string') {
                    return (
                      <div key={index} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        System message
                      </div>
                    );
                  }

                  // Handle attachments
                  try {
                    const parsed = JSON.parse(message.content);
                    if (parsed.type === 'attachment' && parsed.attachment) {
                      const attachment = parsed.attachment;
                      const downloadUrl = `data:${attachment.mimeType};base64,${attachment.data}`;
                      
                      return (
                        <div key={index} className={`message ${isSent ? 'sent' : 'received'}`}>
                          <div className="message-bubble">
                            <div className="message-content">
                              📎 {FormatUtils.getInstance().escapeHtml(attachment.filename)}
                            </div>
                            <a href={downloadUrl} download={attachment.filename} style={{ color: 'var(--primary-green-dark)', textDecoration: 'none' }}>
                              Download
                            </a>
                            <div className="message-time">
                              {FormatUtils.getInstance().formatMessageTime(message.sentAtNs)}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  } catch (e) {
                    // Not JSON, continue
                  }

                  // Regular message
                  return (
                    <div key={index} className={`message ${isSent ? 'sent' : 'received'}`}>
                      <div className="message-bubble">
                        <div className="message-content">{message.content}</div>
                        <div className="message-time">
                          {FormatUtils.getInstance().formatMessageTime(message.sentAtNs)}
                          {isSent && <span className="message-status">✓</span>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <CallControls />

            <form className="chat-input-container" onSubmit={handleSendMessage}>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <div className="chat-input-wrapper">
                <button
                  type="button"
                  className="input-action-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                >
                  📎
                </button>
                <textarea
                  className="chat-input"
                  placeholder="Type a message"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
                  }}
                  rows={1}
                  disabled={isSending}
                />
              </div>
              <button
                type="submit"
                className="send-btn"
                disabled={!messageInput.trim() || isSending}
                title="Send message"
              >
                ➤
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatPage;

