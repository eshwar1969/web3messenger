'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useConversations } from '../hooks/useConversations';
import { useMessages } from '../hooks/useMessages';
import { useAppStore } from '../store/useAppStore';
import { FormatUtils } from '../utils/format';
import { FileService } from '../services/file.service';
import { WebRTCService } from '../services/webrtc.service';
import CallControls from './CallControls';
import { useCallHandler } from '../hooks/useCallHandler';

const ChatWindow: React.FC = () => {
  // Handle incoming call messages
  useCallHandler();
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { currentConversation, messages } = useAppStore();
  const { sendMessage } = useMessages();
  const { selectConversation } = useConversations();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `📎 Preparing to send file: ${file.name}`, type: 'info' }
        }));
        
        await FileService.getInstance().handleFileUpload(file);
        
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: '✅ File sent successfully!', type: 'success' }
        }));
      } catch (error) {
        console.error('Failed to send file:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `❌ File upload failed: ${errorMsg}`, type: 'error' }
        }));
        alert('Failed to send file: ' + errorMsg);
      } finally {
        setIsSending(false);
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const formatMessageTime = (sentAtNs: string) => {
    return FormatUtils.getInstance().formatMessageTime(sentAtNs);
  };

  const handleVoiceCall = async () => {
    if (!currentConversation) {
      alert('Select a conversation first');
      return;
    }

    try {
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '📞 Starting voice call...', type: 'info' }
      }));

      const constraints = { audio: true, video: false };
      await WebRTCService.getInstance().getUserMedia(constraints);
      await WebRTCService.getInstance().initializePeerConnection(true);
      const offer = await WebRTCService.getInstance().createOffer();
      await WebRTCService.getInstance().sendCallOffer('voice', offer);

      useAppStore.getState().setCallState({ state: 'calling', type: 'voice' });
      
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '✅ Voice call offer sent!', type: 'success' }
      }));
    } catch (error) {
      console.error('Voice call failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `❌ Voice call failed: ${errorMsg}`, type: 'error' }
      }));
      alert('Failed to start voice call: ' + errorMsg);
    }
  };

  const handleVideoCall = async () => {
    if (!currentConversation) {
      alert('Select a conversation first');
      return;
    }

    try {
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '📹 Starting video call...', type: 'info' }
      }));

      const constraints = { audio: true, video: true };
      await WebRTCService.getInstance().getUserMedia(constraints);
      await WebRTCService.getInstance().initializePeerConnection(true);
      const offer = await WebRTCService.getInstance().createOffer();
      await WebRTCService.getInstance().sendCallOffer('video', offer);

      useAppStore.getState().setCallState({ state: 'calling', type: 'video' });
      
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '✅ Video call offer sent!', type: 'success' }
      }));
    } catch (error) {
      console.error('Video call failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `❌ Video call failed: ${errorMsg}`, type: 'error' }
      }));
      alert('Failed to start video call: ' + errorMsg);
    }
  };

  if (!currentConversation) {
    return (
      <div className="chat-panel" id="messagesSection">
        <div className="panel-header">
          <div id="currentConversation" className="current-conv">
            <strong>Select a conversation</strong>
          </div>
        </div>
        <div id="messages" className="messages">
          <div className="empty-state">
            Choose or create a conversation to start messaging.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel" id="messagesSection">
      <div className="panel-header">
        <div id="currentConversation" className="current-conv">
          {currentConversation.version === 'DM' && currentConversation.peerInboxId ? (
            <strong>💬 DM with: {currentConversation.peerInboxId}</strong>
          ) : (
            <strong>💬 Group: {currentConversation.id}</strong>
          )}
        </div>
      </div>
      <div id="messages" className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            Choose or create a conversation to start messaging.
          </div>
        ) : (
          messages.map((message: any, index: number) => {
            // Handle system messages (non-string content)
            if (!message.content || typeof message.content !== 'string') {
              let systemText = 'System event';
              
              // Check contentType for more specific system message types
              if (message.contentType) {
                const typeStr = typeof message.contentType === 'string'
                  ? message.contentType
                  : JSON.stringify(message.contentType);
                
                if (typeStr.includes('membership') || typeStr.includes('Membership')) {
                  systemText = 'Group membership updated';
                } else if (typeStr.includes('transcript') || typeStr.includes('Transcript')) {
                  systemText = 'Conversation created';
                } else if (message.content && typeof message.content === 'object') {
                  // Handle metadata objects
                  if (message.content.initiatedByInboxId) {
                    systemText = 'Conversation initiated';
                  } else if (message.content.addedInboxes || message.content.removedInboxes) {
                    systemText = 'Group membership changed';
                  } else {
                    systemText = 'System update';
                  }
                }
              }
              
              return (
                <div key={index} className="message system">
                  <div style={{ textAlign: 'center', color: '#718096', fontSize: '13px', fontStyle: 'italic' }}>
                    {systemText} • {formatMessageTime(message.sentAtNs)}
                  </div>
                </div>
              );
            }

            // Handle attachments
            try {
              const parsedContent = JSON.parse(message.content);
              if (parsedContent.type === 'attachment' && parsedContent.attachment) {
                const attachment = parsedContent.attachment;
                const isSent = message.senderInboxId === useAppStore.getState().xmtpClient?.inboxId;
                const date = new Date(Number(message.sentAtNs) / 1000000);
                const downloadUrl = `data:${attachment.mimeType};base64,${attachment.data}`;
                
                return (
                  <div key={index} className={`message ${isSent ? 'sent' : 'received'}`}>
                    <div className="message-header">
                      <span>{isSent ? '📤 You' : '📥 ' + message.senderInboxId.slice(0, 8)}</span>
                      <span>{formatMessageTime(message.sentAtNs)}</span>
                    </div>
                    <div className="message-content">
                      <div className="attachment">
                        <div className="attachment-info">
                          📎 <strong>{FormatUtils.getInstance().escapeHtml(attachment.filename)}</strong>
                          <br />
                          <small>{FormatUtils.getInstance().formatFileSize(attachment.data.length * 0.75)}</small>
                        </div>
                        <a href={downloadUrl} download={attachment.filename} className="download-btn">
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }
            } catch (e) {
              // Not JSON, continue to regular message
            }

            // Regular text message
            const isSent = message.senderInboxId === useAppStore.getState().xmtpClient?.inboxId;
            return (
              <div key={index} className={`message ${isSent ? 'sent' : 'received'}`}>
                <div className="message-header">
                  <span>{isSent ? '📤 You' : '📥 ' + (message.senderInboxId?.slice(0, 8) || 'Unknown')}</span>
                  <span>{formatMessageTime(message.sentAtNs)}</span>
                </div>
                <div className="message-content">
                  {message.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="composer">
        <textarea
          id="messageInput"
          placeholder="Type your message…"
          rows={3}
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e as any);
            }
          }}
          disabled={isSending}
        />
        <div className="composer-controls">
          <input
            ref={fileInputRef}
            type="file"
            id="fileInput"
            accept="*"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <button
            id="attachBtn"
            className="ghost-action"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
          >
            📎
          </button>
          <button
            id="voiceCallBtn"
            className="ghost-action"
            title="Start voice call"
            disabled={isSending || !currentConversation}
            onClick={handleVoiceCall}
          >
            📞
          </button>
          <button
            id="videoCallBtn"
            className="ghost-action"
            title="Start video call"
            disabled={isSending || !currentConversation}
            onClick={handleVideoCall}
          >
            📹
          </button>
          <button
            id="sendBtn"
            className="primary-action"
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || isSending}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
      <CallControls />
    </div>
  );
};

export default ChatWindow;
