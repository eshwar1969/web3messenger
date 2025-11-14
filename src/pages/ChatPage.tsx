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
import NewChatPanel from '../components/NewChatPanel';
import AddRoomMember from '../components/AddRoomMember';

// Voice Player Component
const VoicePlayer: React.FC<{ audioUrl: string }> = ({ audioUrl }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <button
        onClick={togglePlay}
        style={{
          background: '#667eea',
          border: 'none',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          fontSize: '16px'
        }}
      >
        {isPlaying ? '⏸️' : '▶️'}
      </button>
      <div style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  );
};

const ChatPage: React.FC = () => {
  const router = useRouter();
  const { isConnected } = useXmtp();
  const { conversations, currentConversation, selectConversation, isLoading, loadConversations } = useConversations();
  const { messages, sendMessage } = useMessages();
  const { userProfile, xmtpClient, walletAddress } = useAppStore();
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle calls
  useCallHandler();

  // Redirect if not connected
  useEffect(() => {
    if (!isConnected) {
      router.push('/connect');
    }
  }, [isConnected, router]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(event.target as Node)) {
        setShowMenuDropdown(false);
      }
    };
    if (showMenuDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenuDropdown]);

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

  // Listen for close event from StartDMCompact
  useEffect(() => {
    const handleClose = () => setShowNewChat(false);
    window.addEventListener('close-new-chat', handleClose);
    return () => window.removeEventListener('close-new-chat', handleClose);
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isSending) return;

    // Check if room is blocked
    if (currentConversation && currentConversation.version !== 'DM' && isRoomBlocked(currentConversation.id)) {
      alert('This room is blocked. Please unblock it first to send messages.');
      return;
    }

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
      // Check if room is blocked
      if (currentConversation && currentConversation.version !== 'DM' && isRoomBlocked(currentConversation.id)) {
        alert('This room is blocked. Please unblock it first to send files.');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

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

  const startVoiceRecording = async () => {
    if (!currentConversation) {
      alert('Select a conversation first');
      return;
    }

    // Check if room is blocked
    if (currentConversation.version !== 'DM' && isRoomBlocked(currentConversation.id)) {
      alert('This room is blocked. Please unblock it first to send voice messages.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendVoiceMessage(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '🎤 Recording started...', type: 'info' }
      }));
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please allow microphone access.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '✅ Recording stopped', type: 'success' }
      }));
    }
  };

  const sendVoiceMessage = async (audioBlob: Blob) => {
    try {
      setIsSending(true);

      // Convert blob to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove data:audio/webm;base64, prefix
        };
        reader.onerror = reject;
      });

      // Create voice message attachment
      const attachment = {
        filename: `voice_${Date.now()}.webm`,
        mimeType: 'audio/webm',
        data: base64Data,
        type: 'voice_message'
      };

      // Send as JSON-encoded attachment
      const content = JSON.stringify({
        type: 'attachment',
        attachment: attachment
      });

      if (currentConversation) {
        await currentConversation.send(content);
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: '✅ Voice message sent!', type: 'success' }
        }));
      }
    } catch (error) {
      console.error('Failed to send voice message:', error);
      alert('Failed to send voice message');
    } finally {
      setIsSending(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  const getConversationDisplayName = (conv: any) => {
    if (!conv) return 'Unknown';
    const customName = ConversationService.getInstance().getConversationName(conv.id);
    if (customName) return customName;
    
    if (conv.version === 'DM' && conv.peerInboxId) {
      return FormatUtils.getInstance().formatInboxId(conv.peerInboxId);
    }
    
    // For rooms, assign number if not already assigned
    const roomNumber = ConversationService.getInstance().getRoomNumber(conv.id);
    if (roomNumber) {
      return `Room ${roomNumber}`;
    } else {
      // Assign number for existing rooms without numbers
      const number = ConversationService.getInstance().assignRoomNumber(conv.id);
      return `Room ${number}`;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Calculate member count including current user - sync first to get latest data
  const [memberCount, setMemberCount] = useState<number>(0);
  
  useEffect(() => {
    const updateMemberCount = async () => {
      if (!currentConversation || currentConversation.version === 'DM') {
        setMemberCount(0);
        return;
      }
      
      try {
        // Sync conversation to get latest member list
        await currentConversation.sync();
        const memberIds = currentConversation.memberInboxIds || [];
        const currentUserInboxId = xmtpClient?.inboxId;
        
        // Check if current user is in the member list
        const includesCurrentUser = currentUserInboxId && memberIds.includes(currentUserInboxId);
        
        // If current user is not in the list, add 1 to the count
        const count = includesCurrentUser ? memberIds.length : memberIds.length + 1;
        setMemberCount(count);
      } catch (err) {
        console.error('Error syncing conversation for member count:', err);
        // Fallback to basic count
        const memberIds = currentConversation.memberInboxIds || [];
        const currentUserInboxId = xmtpClient?.inboxId;
        const includesCurrentUser = currentUserInboxId && memberIds.includes(currentUserInboxId);
        setMemberCount(includesCurrentUser ? memberIds.length : memberIds.length + 1);
      }
    };
    
    updateMemberCount();
  }, [currentConversation, xmtpClient?.inboxId]);

  const handleRenameRoom = () => {
    if (!currentConversation) return;
    
    const currentName = ConversationService.getInstance().getConversationName(currentConversation.id);
    setRenameInput(currentName || getConversationDisplayName(currentConversation));
    setShowRenameModal(true);
    setShowMenuDropdown(false);
  };

  const handleShowMembers = () => {
    setShowMembersModal(true);
    setShowMenuDropdown(false);
  };

  // Helper function to check if a room is blocked
  const isRoomBlocked = (roomId: string): boolean => {
    const blockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
    return blockedRooms.includes(roomId);
  };

  const handleBlockRoom = async () => {
    if (!currentConversation) return;
    
    if (confirm(`Are you sure you want to block this room? You will no longer receive messages from this room.`)) {
      try {
        // Store blocked room ID in localStorage
        const blockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
        if (!blockedRooms.includes(currentConversation.id)) {
          blockedRooms.push(currentConversation.id);
          localStorage.setItem('xmtp_blocked_rooms', JSON.stringify(blockedRooms));
        }
        
        // Optionally, leave the room if possible
        try {
          if (currentConversation.removeMembers && xmtpClient?.inboxId) {
            await currentConversation.removeMembers([xmtpClient.inboxId]);
          }
        } catch (e) {
          console.log('Could not remove from room:', e);
        }
        
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `🚫 Room blocked!`, type: 'success' }
        }));
        
        // Reload conversations
        await loadConversations();
        // Clear current conversation
        useAppStore.getState().setCurrentConversation(null);
        
        alert('Room blocked successfully!');
      } catch (error) {
        console.error('Error blocking room:', error);
        alert('Failed to block room. Please try again.');
      }
    }
    setShowMenuDropdown(false);
  };

  const handleUnblockRoom = async () => {
    if (!currentConversation) return;
    
    try {
      // Remove blocked room ID from localStorage
      const blockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
      const updatedRooms = blockedRooms.filter((id: string) => id !== currentConversation.id);
      localStorage.setItem('xmtp_blocked_rooms', JSON.stringify(updatedRooms));
      
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `✅ Room unblocked!`, type: 'success' }
      }));
      
      // Reload conversations
      await loadConversations();
      
      alert('Room unblocked successfully! You can now send and receive messages.');
    } catch (error) {
      console.error('Error unblocking room:', error);
      alert('Failed to unblock room. Please try again.');
    }
    setShowMenuDropdown(false);
  };

  const handleSaveRename = async () => {
    if (!currentConversation) return;
    
    const newName = renameInput.trim();
    
    try {
      if (newName) {
        // Save locally
        ConversationService.getInstance().setConversationName(currentConversation.id, newName);
        
        // Send room name change message to all members
        const roomNameMessage = JSON.stringify({
          type: 'room_name_change',
          roomId: currentConversation.id,
          roomName: newName,
          timestamp: Date.now()
        });
        
        await currentConversation.send(roomNameMessage);
        
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `✅ Room name updated and shared with members!`, type: 'success' }
        }));
      } else {
        ConversationService.getInstance().removeConversationName(currentConversation.id);
        
        // Send room name removal message
        const roomNameMessage = JSON.stringify({
          type: 'room_name_change',
          roomId: currentConversation.id,
          roomName: null,
          timestamp: Date.now()
        });
        
        await currentConversation.send(roomNameMessage);
        
        window.dispatchEvent(new CustomEvent('app-log', {
          detail: { message: `✅ Room name removed!`, type: 'success' }
        }));
      }
      
      setShowRenameModal(false);
      setRenameInput('');
      // Force re-render by reloading conversations
      loadConversations();
    } catch (error) {
      console.error('Error saving room name:', error);
      alert('Failed to save room name. Please try again.');
    }
  };

  const handleVoiceCall = async () => {
    if (!currentConversation) {
      alert('Select a conversation first');
      return;
    }

    const { callState } = useAppStore.getState();
    if (callState.state !== 'idle') {
      alert('A call is already in progress');
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
      useAppStore.getState().setCallState({ state: 'idle', type: null });
    }
  };

  const handleVideoCall = async () => {
    if (!currentConversation) {
      alert('Select a conversation first');
      return;
    }

    const { callState } = useAppStore.getState();
    if (callState.state !== 'idle') {
      alert('A call is already in progress');
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
      useAppStore.getState().setCallState({ state: 'idle', type: null });
    }
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
            <div 
              className="user-avatar" 
              onClick={() => setShowAddressModal(true)}
              style={{ cursor: 'pointer' }}
              title="Click to view wallet address"
            >
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
          <NewChatPanel onClose={() => setShowNewChat(false)} />
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
              const isBlocked = conv.version !== 'DM' && isRoomBlocked(conv.id);
              // Get last message for this specific conversation
              const lastMessage = isActive && messages.length > 0 
                ? messages[messages.length - 1] 
                : null;
              
              return (
                <div
                  key={conv.id || index}
                  className={`conversation-item ${isActive ? 'active' : ''}`}
                  onClick={() => selectConversation(index)}
                  style={isBlocked ? { opacity: 0.6, background: isActive ? '#fee2e2' : '#fef2f2' } : {}}
                >
                  <div className="conversation-avatar">
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="conversation-info">
                    <div className="conversation-header">
                      <div className="conversation-name">
                        {displayName}
                        {isBlocked && <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#dc2626' }}>🚫</span>}
                      </div>
                      {lastMessage && (
                        <div className="conversation-time">
                          {FormatUtils.getInstance().formatMessageTime(lastMessage.sentAtNs)}
                        </div>
                      )}
                    </div>
                    <div className="conversation-preview">
                      {isBlocked ? (
                        <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>Blocked</span>
                      ) : lastMessage ? (
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
                  <h2 
                    onClick={currentConversation.version !== 'DM' ? handleShowMembers : undefined}
                    style={{ 
                      cursor: currentConversation.version !== 'DM' ? 'pointer' : 'default',
                      userSelect: 'none'
                    }}
                    title={currentConversation.version !== 'DM' ? 'Click to view members' : ''}
                  >
                    {getConversationDisplayName(currentConversation)}
                  </h2>
                  <p>
                    {currentConversation.version === 'DM' 
                      ? 'Direct message' 
                      : `${memberCount} members`}
                  </p>
                </div>
              </div>
              <div className="chat-header-actions" style={{ position: 'relative' }}>
                <button 
                  className="icon-btn" 
                  title="Voice call"
                  onClick={handleVoiceCall}
                >
                  📞
                </button>
                <button 
                  className="icon-btn" 
                  title="Video call"
                  onClick={handleVideoCall}
                >
                  📹
                </button>
                <div ref={menuDropdownRef} style={{ position: 'relative' }}>
                  <button 
                    className="icon-btn" 
                    title="More options"
                    onClick={() => setShowMenuDropdown(!showMenuDropdown)}
                  >
                    ⋯
                  </button>
                  {showMenuDropdown && currentConversation.version !== 'DM' && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      background: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      minWidth: '180px',
                      zIndex: 1000,
                      border: '1px solid var(--border-color)'
                    }}>
                      <button
                        onClick={handleRenameRoom}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: 'none',
                          background: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-light)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        ✏️ Change Room Name
                      </button>
                      {isRoomBlocked(currentConversation.id) ? (
                        <button
                          onClick={handleUnblockRoom}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderTop: '1px solid var(--border-color)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#d1fae5'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          ✅ Unblock Room
                        </button>
                      ) : (
                        <button
                          onClick={handleBlockRoom}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '14px',
                            color: '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            borderTop: '1px solid var(--border-color)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          🚫 Block Room
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Add Member Section for Rooms */}
            {currentConversation.version !== 'DM' && (
              <div style={{ padding: '0.75rem 1rem', background: 'var(--background-light)', borderBottom: '1px solid var(--border-color)' }}>
                <AddRoomMember 
                  conversation={currentConversation}
                  onMemberAdded={async () => {
                    // Reload conversations to update member count
                    await loadConversations();
                    // Update member count by syncing
                    try {
                      await currentConversation.sync();
                      const memberIds = currentConversation.memberInboxIds || [];
                      const currentUserInboxId = xmtpClient?.inboxId;
                      const includesCurrentUser = currentUserInboxId && memberIds.includes(currentUserInboxId);
                      setMemberCount(includesCurrentUser ? memberIds.length : memberIds.length + 1);
                    } catch (err) {
                      console.error('Error updating member count:', err);
                    }
                  }}
                />
              </div>
            )}

            <div className="chat-messages">
              {currentConversation && currentConversation.version !== 'DM' && isRoomBlocked(currentConversation.id) ? (
                <div className="empty-chat">
                  <div className="empty-chat-icon">🚫</div>
                  <h3>This room is blocked</h3>
                  <p>You cannot send or receive messages in this room.</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    Use the menu (⋯) to unblock this room.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="empty-chat">
                  <div className="empty-chat-icon">💬</div>
                  <h3>No messages yet</h3>
                  <p>Start the conversation by sending a message</p>
                </div>
              ) : (
                messages
                  .map((message: any, index: number) => {
                    const isSent = message.senderInboxId === xmtpClient?.inboxId;
                    
                    // Handle system messages
                    if (!message.content || typeof message.content !== 'string') {
                      return (
                        <div key={index} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                          System message
                        </div>
                      );
                    }

                    // Handle special message types (attachments, room name changes, etc.)
                    try {
                      const parsed = JSON.parse(message.content);
                      
                      // Handle room name change messages - don't display, just process
                      if (parsed.type === 'room_name_change' && parsed.roomId === currentConversation.id) {
                        // Update local storage with the new room name
                        if (parsed.roomName) {
                          ConversationService.getInstance().setConversationName(parsed.roomId, parsed.roomName);
                        } else {
                          ConversationService.getInstance().removeConversationName(parsed.roomId);
                        }
                        // Reload conversations to reflect the change
                        loadConversations();
                        // Don't display this as a regular message, it's a system update
                        return null;
                      }
                      
                      // Handle attachments
                      if (parsed.type === 'attachment' && parsed.attachment) {
                        const attachment = parsed.attachment;
                        const downloadUrl = `data:${attachment.mimeType};base64,${attachment.data}`;
                        
                        // Handle voice messages
                        if (attachment.type === 'voice_message' || attachment.mimeType?.startsWith('audio/')) {
                          return (
                            <div key={index} className={`message ${isSent ? 'sent' : 'received'}`}>
                              <div className="message-bubble">
                                <div className="message-content" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <VoicePlayer audioUrl={downloadUrl} />
                                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    🎤 Voice message
                                  </span>
                                </div>
                                <div className="message-time">
                                  {FormatUtils.getInstance().formatMessageTime(message.sentAtNs)}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        // Regular file attachments
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
                  .filter((msg: any) => msg !== null) // Filter out null returns from room name change messages
              )}
              <div ref={messagesEndRef} />
            </div>

            <CallControls />

            {currentConversation && currentConversation.version !== 'DM' && isRoomBlocked(currentConversation.id) ? (
              <div style={{ 
                padding: '1rem', 
                textAlign: 'center', 
                background: '#fee2e2', 
                color: '#dc2626',
                borderTop: '1px solid #fecaca',
                fontSize: '0.875rem'
              }}>
                🚫 This room is blocked. Unblock it from the menu (⋯) to send messages.
              </div>
            ) : (
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
                    disabled={isSending || isRecording}
                  />
                </div>
                {isRecording ? (
                  <button
                    type="button"
                    className="send-btn"
                    onClick={stopVoiceRecording}
                    style={{
                      background: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px'
                    }}
                    title="Stop recording"
                  >
                    <span>⏹️</span>
                    <span>{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="send-btn"
                      onClick={startVoiceRecording}
                      disabled={isSending}
                      style={{
                        background: '#667eea',
                        marginRight: '8px'
                      }}
                      title="Record voice message"
                    >
                      🎤
                    </button>
                    <button
                      type="submit"
                      className="send-btn"
                      disabled={!messageInput.trim() || isSending}
                      title="Send message"
                    >
                      ➤
                    </button>
                  </>
                )}
              </form>
            )}
          </>
        )}
      </div>

      {/* Profile Info Modal */}
      {showAddressModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowAddressModal(false)}
        >
          <div 
            style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Your Info</h3>
            
            {/* Inbox ID Section */}
            {xmtpClient?.inboxId && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
                  📬 Your Inbox ID
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ 
                    margin: '0', 
                    fontSize: '13px', 
                    wordBreak: 'break-all', 
                    fontFamily: 'monospace', 
                    background: '#f8fafc', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    border: '1px solid #e2e8f0', 
                    flex: 1 
                  }}>
                    {xmtpClient.inboxId}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(xmtpClient.inboxId);
                      window.dispatchEvent(new CustomEvent('app-log', {
                        detail: { message: '📋 Inbox ID copied!', type: 'success' }
                      }));
                      alert('Inbox ID copied to clipboard!');
                    }}
                    className="ghost-action"
                    style={{ padding: '10px 20px', fontSize: '14px', whiteSpace: 'nowrap', fontWeight: '600' }}
                    title="Copy inbox ID"
                  >
                    📋 Copy
                  </button>
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-secondary)', 
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  background: '#f0f7ff',
                  borderRadius: '6px',
                  border: '1px solid #dbeafe'
                }}>
                  💡 Share this with others so they can add you to rooms or start DMs
                </div>
              </div>
            )}
            
            {/* Wallet Address Section */}
            {walletAddress && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                  🔑 Your Wallet Address
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p style={{ 
                    margin: '0', 
                    fontSize: '13px', 
                    wordBreak: 'break-all', 
                    fontFamily: 'monospace', 
                    background: '#f8fafc', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    border: '1px solid #e2e8f0', 
                    flex: 1 
                  }}>
                    {walletAddress}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(walletAddress);
                      window.dispatchEvent(new CustomEvent('app-log', {
                        detail: { message: '📋 Wallet address copied!', type: 'success' }
                      }));
                      alert('Wallet address copied to clipboard!');
                    }}
                    className="ghost-action"
                    style={{ padding: '10px 20px', fontSize: '14px', whiteSpace: 'nowrap', fontWeight: '600' }}
                    title="Copy wallet address"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            )}
            
            <button
              onClick={() => setShowAddressModal(false)}
              style={{ 
                width: '100%', 
                padding: '10px', 
                background: '#667eea', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Rename Room Modal */}
      {showRenameModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001
          }}
          onClick={() => setShowRenameModal(false)}
        >
          <div 
            style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
              Change Room Name
            </h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="Enter room name"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                marginBottom: '16px',
                boxSizing: 'border-box'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSaveRename();
                }
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRenameModal(false);
                  setRenameInput('');
                }}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'var(--text-secondary)'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRename}
                style={{
                  padding: '10px 20px',
                  background: '#667eea',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'white'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {showMembersModal && currentConversation && currentConversation.version !== 'DM' && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1002
          }}
          onClick={() => setShowMembersModal(false)}
        >
          <div 
            style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
              Room Members ({memberCount})
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              {(() => {
                const memberIds = currentConversation.memberInboxIds || [];
                const currentUserInboxId = xmtpClient?.inboxId;
                const allMembers = [...memberIds];
                
                // Add current user if not in the list
                if (currentUserInboxId && !memberIds.includes(currentUserInboxId)) {
                  allMembers.push(currentUserInboxId);
                }
                
                if (allMembers.length === 0) {
                  return (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No members found
                    </div>
                  );
                }
                
                return allMembers.map((inboxId: string, index: number) => {
                  const isCurrentUser = inboxId === currentUserInboxId;
                  
                  return (
                    <div
                      key={index}
                      style={{
                        padding: '12px',
                        marginBottom: '8px',
                        background: isCurrentUser ? '#f0f7ff' : '#f8fafc',
                        borderRadius: '8px',
                        border: `1px solid ${isCurrentUser ? '#dbeafe' : '#e2e8f0'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            fontWeight: 600, 
                            marginBottom: '6px',
                            color: isCurrentUser ? '#1e40af' : 'var(--text-primary)',
                            fontSize: '14px'
                          }}>
                            {isCurrentUser ? '👤 You' : `Member ${index + 1}`}
                          </div>
                          <div style={{ 
                            fontSize: '0.75rem', 
                            color: 'var(--text-secondary)',
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                            marginBottom: '4px'
                          }}>
                            <strong>Inbox ID:</strong> {inboxId}
                          </div>
                          {isCurrentUser && walletAddress && (
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: 'var(--text-secondary)',
                              fontFamily: 'monospace',
                              wordBreak: 'break-all',
                              marginTop: '4px'
                            }}>
                              <strong>Wallet Address:</strong> {walletAddress}
                            </div>
                          )}
                          {!isCurrentUser && (
                            <div style={{ 
                              fontSize: '0.7rem', 
                              color: '#6b7280',
                              marginTop: '4px',
                              fontStyle: 'italic'
                            }}>
                              💡 Wallet address not available (only inbox ID is stored)
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(inboxId);
                            window.dispatchEvent(new CustomEvent('app-log', {
                              detail: { message: '📋 Inbox ID copied!', type: 'success' }
                            }));
                            alert('Inbox ID copied to clipboard!');
                          }}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap',
                            marginLeft: '8px',
                            alignSelf: 'flex-start'
                          }}
                          title="Copy inbox ID"
                        >
                          📋 Copy ID
                        </button>
                      </div>
                      {isCurrentUser && walletAddress && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(walletAddress);
                            window.dispatchEvent(new CustomEvent('app-log', {
                              detail: { message: '📋 Wallet address copied!', type: 'success' }
                            }));
                            alert('Wallet address copied to clipboard!');
                          }}
                          style={{
                            padding: '6px 12px',
                            background: 'transparent',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            whiteSpace: 'nowrap',
                            alignSelf: 'flex-start'
                          }}
                          title="Copy wallet address"
                        >
                          📋 Copy Wallet
                        </button>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
            
            <button
              onClick={() => setShowMembersModal(false)}
              style={{ 
                width: '100%', 
                padding: '10px', 
                background: '#667eea', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;

