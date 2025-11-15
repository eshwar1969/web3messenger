import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';
import { ConversationService } from '../services/conversation.service';

export const useConversations = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    xmtpClient,
    conversations,
    currentConversation,
    messages,
    setConversations,
    setCurrentConversation,
    setMessages
  } = useAppStore();

  const loadConversations = useCallback(async () => {
    if (!xmtpClient) return;

    try {
      setIsLoading(true);
      setError(null);

      console.log('Loading conversations...');
      
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '📂 Loading conversations...', type: 'info' }
      }));
      
      const convs = await XmtpService.getInstance().loadConversations();
      
      // Mark DMs properly - use localStorage tracking for reliable identification
      const { ConversationService } = await import('../services/conversation.service');
      const currentUserInboxId = xmtpClient.inboxId;
      
      const markedConversations = convs.map((conv: any) => {
        // First, check localStorage - this is the most reliable
        const isStoredDM = ConversationService.getInstance().isDM(conv.id);
        if (isStoredDM) {
          const peerInboxId = ConversationService.getInstance().getDMPeerInboxId(conv.id);
          conv.peerInboxId = peerInboxId || conv.peerInboxId;
          conv.version = 'DM';
          return conv;
        }
        
        // If already marked as DM in object, store it
        if (conv.version === 'DM' || conv.peerInboxId) {
          if (conv.peerInboxId) {
            ConversationService.getInstance().markAsDM(conv.id, conv.peerInboxId);
          }
          return conv;
        }
        
        // Check if it's a DM by member count (1 or 2 members = DM, private chat)
        const memberIds = conv.memberInboxIds || [];
        
        // If there's exactly 1 member and it's not the current user, it's a DM
        if (memberIds.length === 1 && currentUserInboxId && !memberIds.includes(currentUserInboxId)) {
          const peerId = memberIds[0];
          conv.peerInboxId = peerId;
          conv.version = 'DM';
          ConversationService.getInstance().markAsDM(conv.id, peerId);
          return conv;
        }
        
        // If there are exactly 2 members (you + 1 other = DM)
        if (memberIds.length === 2 && currentUserInboxId) {
          let peerId: string | null = null;
          if (memberIds.includes(currentUserInboxId)) {
            // Current user is in the list, so the other member is the peer
            peerId = memberIds.find((id: string) => id !== currentUserInboxId) || null;
          } else {
            // Current user not in list but there are 2 members - still a DM
            peerId = memberIds[0]; // Use first member as peer
          }
          
          if (peerId) {
            conv.peerInboxId = peerId;
            conv.version = 'DM';
            ConversationService.getInstance().markAsDM(conv.id, peerId);
          }
          return conv;
        }
        
        // Not a DM (group chat with 3+ members), return as-is
        return conv;
      });
      
      setConversations(markedConversations);

      console.log(`${markedConversations.length} conversation(s) found`);
      
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `✅ ${markedConversations.length} conversation(s) found`, type: 'success' }
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(errorMessage);
      console.error('Error loading conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [xmtpClient, setConversations]);

  const loadMessages = useCallback(async (conversation: any) => {
    try {
      await conversation.sync();
      const msgs = await conversation.messages();
      // Deduplicate messages by ID or sentAtNs to prevent duplicates
      const uniqueMessages = msgs.filter((msg: any, index: number, self: any[]) => 
        index === self.findIndex((m: any) => 
          m.id === msg.id || 
          (m.sentAtNs === msg.sentAtNs && m.senderInboxId === msg.senderInboxId)
        )
      );
      setMessages(uniqueMessages);
      console.log(`${uniqueMessages.length} message(s) loaded`);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  }, [setMessages]);

  const selectConversation = useCallback(async (index: number) => {
    const conversation = conversations[index];
    if (!conversation) return;

    // Check if it's a DM (using the same logic as ChatPage)
    const memberIds = conversation.memberInboxIds || [];
    const currentUserInboxId = xmtpClient?.inboxId;
    const isDM = conversation.version === 'DM' || 
                 conversation.peerInboxId ||
                 (memberIds.length === 1 && currentUserInboxId && !memberIds.includes(currentUserInboxId)) ||
                 (memberIds.length === 2 && currentUserInboxId && memberIds.includes(currentUserInboxId));
    
    // Check if room is blocked (only for non-DMs)
    const blockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
    if (!isDM && blockedRooms.includes(conversation.id)) {
      // Still set the conversation so user can see the blocked message, but don't load messages
      setCurrentConversation(conversation);
      setMessages([]); // Clear messages for blocked rooms
      console.log('Conversation selected (blocked room)');
      return;
    }

    setCurrentConversation(conversation);
    console.log('Conversation selected');

    // Load messages for the selected conversation
    await loadMessages(conversation);

  }, [conversations, setCurrentConversation, setMessages, loadMessages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!currentConversation) {
      throw new Error('No conversation selected');
    }

    try {
      await currentConversation.send(content);
      console.log('Message sent successfully');

      // Reload messages to include the new one
      await loadMessages(currentConversation);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      console.error('Send error:', err);
      throw new Error(errorMessage);
    }
  }, [currentConversation, loadMessages]);

  const createDM = useCallback(async (inboxId: string) => {
    if (!xmtpClient) throw new Error('XMTP client not initialized');

    try {
      // createDM will handle both getting existing DM and creating new one
      const dm: any = await XmtpService.getInstance().createDM(inboxId);

      if (!dm) {
        throw new Error('Failed to create or retrieve DM');
      }

      // Ensure DM is properly marked
      if (dm && !dm.peerInboxId) {
        dm.peerInboxId = inboxId;
      }
      if (dm && !dm.version) {
        dm.version = 'DM';
      }

      console.log('DM conversation ready:', dm.version === 'DM' ? 'DM' : 'Group (fallback)');
      
      await loadConversations();
      return dm;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create DM';
      console.error('Error creating DM:', err);
      throw new Error(errorMessage);
    }
  }, [xmtpClient, loadConversations]);

  // Load conversations when XMTP client is ready
  useEffect(() => {
    if (xmtpClient) {
      loadConversations();
    }
  }, [xmtpClient, loadConversations]);

  // Stream new conversations
  useEffect(() => {
    if (!xmtpClient) return;

    const streamConversations = async () => {
      try {
        console.log('Listening for new conversations...');
        const stream = await XmtpService.getInstance().streamConversations();

        for await (const conversation of stream) {
          console.log('New conversation detected!');
          
          // IMPORTANT: Auto-detect if this is a DM on the receiver's side
          // This ensures when someone starts a DM with you, you see it as a DM too
          try {
            await conversation.sync();
            const memberIds = conversation.memberInboxIds || [];
            const currentUserInboxId = xmtpClient.inboxId;
            
            // Check if it's a DM (1 or 2 members = private chat)
            const isDM = (memberIds.length === 1 && currentUserInboxId && !memberIds.includes(currentUserInboxId)) ||
                         (memberIds.length === 2 && currentUserInboxId && memberIds.includes(currentUserInboxId));
            
            if (isDM && !ConversationService.getInstance().isDM(conversation.id)) {
              // Auto-detect and mark as DM on receiver's side
              let peerId: string | null = null;
              if (memberIds.length === 1) {
                peerId = memberIds[0];
              } else if (memberIds.length === 2) {
                peerId = memberIds.find((id: string) => id !== currentUserInboxId) || memberIds[0];
              }
              
              if (peerId) {
                ConversationService.getInstance().markAsDM(conversation.id, peerId);
                conversation.peerInboxId = peerId;
                conversation.version = 'DM';
                console.log('✅ Auto-detected new DM conversation on receiver side:', { id: conversation.id, peerId });
              }
            }
          } catch (syncError) {
            // If sync fails, continue anyway - loadConversations will handle it
            console.log('Could not sync new conversation for DM detection:', syncError);
          }
          
          await loadConversations();
        }
      } catch (err) {
        console.error('Conversation stream error:', err);
      }
    };

    streamConversations();
  }, [xmtpClient, loadConversations]);

  // Stream messages for current conversation
  useEffect(() => {
    if (!currentConversation) return;

    const streamMessages = async () => {
      try {
        // Check if it's a DM
        const memberIds = currentConversation.memberInboxIds || [];
        const currentUserInboxId = xmtpClient?.inboxId;
        const isDM = currentConversation.version === 'DM' || 
                     currentConversation.peerInboxId ||
                     (memberIds.length === 1 && currentUserInboxId && !memberIds.includes(currentUserInboxId)) ||
                     (memberIds.length === 2 && currentUserInboxId && memberIds.includes(currentUserInboxId));
        
        // Check if room is blocked (only for non-DMs)
        const blockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
        if (!isDM && blockedRooms.includes(currentConversation.id)) {
          // Don't stream messages for blocked rooms
          return;
        }

        console.log('Listening for new messages...');
        const stream = await currentConversation.stream();

        for await (const message of stream) {
          // Check again if room is blocked (in case it was blocked while streaming)
          const currentMemberIds = currentConversation.memberInboxIds || [];
          const currentUserInboxId = xmtpClient?.inboxId;
          const isDM = currentConversation.version === 'DM' || 
                       currentConversation.peerInboxId ||
                       (currentMemberIds.length === 1 && currentUserInboxId && !currentMemberIds.includes(currentUserInboxId)) ||
                       (currentMemberIds.length === 2 && currentUserInboxId && currentMemberIds.includes(currentUserInboxId));
          
          const currentBlockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
          if (!isDM && currentBlockedRooms.includes(currentConversation.id)) {
            // Stop processing messages if room is blocked
            break;
          }

          console.log('New message received!');
          
        // Check if it's a special message type (call, room name change, etc.)
        try {
          const content = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
          if (content && typeof content === 'object') {
            // Handle call messages separately - useCallHandler will process it
            if (content.type === 'call_offer' || content.type === 'call_answer' || content.type === 'call_response' || content.type === 'ice_candidate' || content.type === 'end_call') {
              continue;
            }
            
            // Handle room name change messages
            if (content.type === 'room_name_change' && content.roomId) {
              if (content.roomName) {
                ConversationService.getInstance().setConversationName(content.roomId, content.roomName);
              } else {
                ConversationService.getInstance().removeConversationName(content.roomId);
              }
              // Reload conversations to reflect the change
              await loadConversations();
              // Don't add to regular messages
              continue;
            }
          }
        } catch (e) {
          // Not a special message, continue
        }
        
        // IMPORTANT: When receiving a message, check if this conversation is a DM
        // This ensures the receiver also sees it as a DM (not a group)
        // Sync the conversation first to get accurate member count
        try {
          await currentConversation.sync();
          const memberIds = currentConversation.memberInboxIds || [];
          const currentUserInboxId = xmtpClient?.inboxId;
          
          // Check if it's a DM (1 or 2 members = private chat)
          const isDM = (memberIds.length === 1 && currentUserInboxId && !memberIds.includes(currentUserInboxId)) ||
                       (memberIds.length === 2 && currentUserInboxId && memberIds.includes(currentUserInboxId));
          
          if (isDM && !ConversationService.getInstance().isDM(currentConversation.id)) {
            // Auto-detect and mark as DM on receiver's side
            let peerId: string | null = null;
            if (memberIds.length === 1) {
              peerId = memberIds[0];
            } else if (memberIds.length === 2) {
              peerId = memberIds.find((id: string) => id !== currentUserInboxId) || memberIds[0];
            }
            
            if (peerId) {
              ConversationService.getInstance().markAsDM(currentConversation.id, peerId);
              // Also update the conversation object
              currentConversation.peerInboxId = peerId;
              currentConversation.version = 'DM';
              console.log('✅ Auto-detected and marked as DM on receiver side:', { id: currentConversation.id, peerId });
            }
          }
        } catch (syncError) {
          // If sync fails, continue anyway
          console.log('Could not sync conversation for DM detection:', syncError);
        }
          
          // Dispatch log event
          window.dispatchEvent(new CustomEvent('app-log', {
            detail: { message: '✨ New message received!', type: 'success' }
          }));
          
          // Reload messages to include the new one
          await loadMessages(currentConversation);
        }
      } catch (err) {
        console.error('Message stream error:', err);
      }
    };

    streamMessages();
  }, [currentConversation, loadMessages]);

  return {
    conversations,
    currentConversation,
    messages,
    isLoading,
    error,
    loadConversations,
    selectConversation,
    sendMessage,
    createDM
  };
};
