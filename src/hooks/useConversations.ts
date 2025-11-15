import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';
import { ConversationService } from '../services/conversation.service';
import { NotificationService } from '../services/notification.service';
import { FormatUtils } from '../utils/format';

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

      // Ensure XmtpService has the client reference
      XmtpService.getInstance().setClient(xmtpClient);

      console.log('Loading conversations...');
      
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '📂 Loading conversations...', type: 'info' }
      }));
      
      const convs = await XmtpService.getInstance().loadConversations();
      
      // Mark DMs properly - use localStorage tracking for reliable identification
      const { ConversationService } = await import('../services/conversation.service');
      const currentUserInboxId = xmtpClient.inboxId;
      
      // CRITICAL: Sync all conversations first to get accurate member counts
      // This is especially important for the receiver to detect DMs correctly
      const syncedConversations = await Promise.all(
        convs.map(async (conv: any) => {
          try {
            await conv.sync();
            return conv;
          } catch (syncError) {
            console.warn(`Could not sync conversation ${conv.id}:`, syncError);
            return conv; // Return unsynced if sync fails
          }
        })
      );
      
      const markedConversations = syncedConversations.map((conv: any) => {
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
        // CRITICAL: Use synced member list for accurate detection
        const memberIds = conv.memberInboxIds || [];
        
        // If there's exactly 1 member and it's not the current user, it's a DM
        if (memberIds.length === 1 && currentUserInboxId && !memberIds.includes(currentUserInboxId)) {
          const peerId = memberIds[0];
          conv.peerInboxId = peerId;
          conv.version = 'DM';
          ConversationService.getInstance().markAsDM(conv.id, peerId);
          console.log('✅ Detected DM (1 member, not current user):', { id: conv.id, peerId });
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
            console.log('✅ Detected DM (2 members):', { id: conv.id, peerId });
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

    // CRITICAL: Sync conversation first to get accurate member list
    // This ensures DM detection works correctly for the receiver
    try {
      await conversation.sync();
    } catch (syncError) {
      console.warn('Could not sync conversation on select:', syncError);
    }

    // Check if it's a DM (using the same logic as ChatPage)
    const memberIds = conversation.memberInboxIds || [];
    const currentUserInboxId = xmtpClient?.inboxId;
    
    // Use ConversationService to check if it's a DM (most reliable)
    const { ConversationService } = await import('../services/conversation.service');
    let isDM = ConversationService.getInstance().isDM(conversation.id);
    
    // If not in localStorage, check by member count
    if (!isDM) {
      isDM = conversation.version === 'DM' || 
             conversation.peerInboxId ||
             (memberIds.length === 1 && currentUserInboxId && !memberIds.includes(currentUserInboxId)) ||
             (memberIds.length === 2 && currentUserInboxId && memberIds.includes(currentUserInboxId));
      
      // If detected as DM, mark it immediately
      if (isDM) {
        let peerId: string | null = null;
        if (conversation.peerInboxId) {
          peerId = conversation.peerInboxId;
        } else if (memberIds.length === 1) {
          peerId = memberIds[0];
        } else if (memberIds.length === 2) {
          peerId = memberIds.find((id: string) => id !== currentUserInboxId) || memberIds[0];
        }
        
        if (peerId) {
          ConversationService.getInstance().markAsDM(conversation.id, peerId);
          conversation.peerInboxId = peerId;
          conversation.version = 'DM';
          console.log('✅ Auto-detected DM when selecting conversation:', { id: conversation.id, peerId });
          
          // Reload conversations to update UI
          await loadConversations();
        }
      }
    }
    
    // Check if room is blocked (only for non-DMs)
    const blockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
    if (!isDM && blockedRooms.includes(conversation.id)) {
      // Still set the conversation so user can see the blocked message, but don't load messages
      setCurrentConversation(conversation);
      setMessages([]); // Clear messages for blocked rooms
      // Update notification service
      NotificationService.getInstance().setCurrentConversation(conversation.id);
      console.log('Conversation selected (blocked room)');
      return;
    }

    setCurrentConversation(conversation);
    // Update notification service to track current conversation
    NotificationService.getInstance().setCurrentConversation(conversation.id);
    console.log('Conversation selected', isDM ? '(DM)' : '(Room)');

    // Load messages for the selected conversation
    await loadMessages(conversation);

  }, [conversations, setCurrentConversation, setMessages, loadMessages, xmtpClient, loadConversations]);

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
      // Ensure XmtpService has the client reference
      XmtpService.getInstance().setClient(xmtpClient);
      
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

      // CRITICAL: Sync the conversation after creation to ensure it's visible to the receiver
      // This is important for message delivery
      try {
        await dm.sync();
        console.log('✅ DM conversation synced after creation');
      } catch (syncError) {
        console.warn('Could not sync DM conversation after creation:', syncError);
        // Continue anyway
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
        // Ensure XmtpService has the client reference
        XmtpService.getInstance().setClient(xmtpClient);
        
        console.log('Listening for new conversations...');
        const stream = await XmtpService.getInstance().streamConversations();

        for await (const conversation of stream) {
          console.log('New conversation detected!');
          
          // IMPORTANT: Auto-detect if this is a DM on the receiver's side
          // This ensures when someone starts a DM with you, you see it as a DM too
          let isDM = false;
          let conversationName = 'New Conversation';
          
          try {
            await conversation.sync();
            const memberIds = conversation.memberInboxIds || [];
            const currentUserInboxId = xmtpClient.inboxId;
            
            // Check if it's a DM (1 or 2 members = private chat)
            isDM = (memberIds.length === 1 && currentUserInboxId && !memberIds.includes(currentUserInboxId)) ||
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
            
            // Get conversation name for notification
            if (isDM) {
              const peerInboxId = conversation.peerInboxId || ConversationService.getInstance().getDMPeerInboxId(conversation.id);
              const storedAddresses = JSON.parse(localStorage.getItem('dm_wallet_addresses') || '{}');
              const walletAddress = peerInboxId ? storedAddresses[peerInboxId] : null;
              conversationName = walletAddress ? FormatUtils.getInstance().formatAddress(walletAddress) : 'DM';
            } else {
              const customName = ConversationService.getInstance().getConversationName(conversation.id);
              const roomNumber = ConversationService.getInstance().getRoomNumber(conversation.id);
              conversationName = customName || (roomNumber ? `Room ${roomNumber}` : 'New Room');
            }
          } catch (syncError) {
            // If sync fails, continue anyway - loadConversations will handle it
            console.log('Could not sync new conversation for DM detection:', syncError);
          }
          
          // Show notification for new conversation
          await NotificationService.getInstance().showConversationNotification(
            conversationName,
            conversation.id,
            isDM
          );
          
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
    if (!currentConversation || !xmtpClient) return;

    const streamMessages = async () => {
      try {
        // CRITICAL: Sync conversation first to get accurate member list
        // This ensures DM detection works correctly for the receiver
        try {
          await currentConversation.sync();
        } catch (syncError) {
          console.warn('Could not sync conversation before streaming:', syncError);
        }
        
        // Check if it's a DM using synced data
        const memberIds = currentConversation.memberInboxIds || [];
        const currentUserInboxId = xmtpClient.inboxId;
        
        // Use ConversationService to check if it's a DM (most reliable)
        const { ConversationService } = await import('../services/conversation.service');
        let isDM = ConversationService.getInstance().isDM(currentConversation.id);
        
        // If not in localStorage, check by member count
        if (!isDM) {
          isDM = currentConversation.version === 'DM' || 
                 currentConversation.peerInboxId ||
                 (memberIds.length === 1 && currentUserInboxId && !memberIds.includes(currentUserInboxId)) ||
                 (memberIds.length === 2 && currentUserInboxId && memberIds.includes(currentUserInboxId));
          
          // If detected as DM, mark it in localStorage
          if (isDM) {
            let peerId: string | null = null;
            if (currentConversation.peerInboxId) {
              peerId = currentConversation.peerInboxId;
            } else if (memberIds.length === 1) {
              peerId = memberIds[0];
            } else if (memberIds.length === 2) {
              peerId = memberIds.find((id: string) => id !== currentUserInboxId) || memberIds[0];
            }
            
            if (peerId) {
              ConversationService.getInstance().markAsDM(currentConversation.id, peerId);
              currentConversation.peerInboxId = peerId;
              currentConversation.version = 'DM';
              console.log('✅ Auto-detected DM in message stream:', { id: currentConversation.id, peerId });
            }
          }
        }
        
        // Check if room is blocked (only for non-DMs)
        const blockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
        if (!isDM && blockedRooms.includes(currentConversation.id)) {
          // Don't stream messages for blocked rooms
          return;
        }

        console.log('Listening for new messages...', isDM ? '(DM)' : '(Room)');
        const stream = await currentConversation.stream();

        for await (const message of stream) {
          // CRITICAL: Re-check DM status on each message to ensure receiver detects it
          // Sync conversation to get latest member list
          try {
            await currentConversation.sync();
          } catch (syncError) {
            // Continue if sync fails
          }
          
          // Check again if room is blocked (in case it was blocked while streaming)
          const currentMemberIds = currentConversation.memberInboxIds || [];
          const currentUserInboxId = xmtpClient.inboxId;
          
          // Re-check DM status using ConversationService (most reliable)
          let currentIsDM = ConversationService.getInstance().isDM(currentConversation.id);
          
          // If not in localStorage, check by member count
          if (!currentIsDM) {
            currentIsDM = currentConversation.version === 'DM' || 
                         currentConversation.peerInboxId ||
                         (currentMemberIds.length === 1 && currentUserInboxId && !currentMemberIds.includes(currentUserInboxId)) ||
                         (currentMemberIds.length === 2 && currentUserInboxId && currentMemberIds.includes(currentUserInboxId));
            
            // If detected as DM, mark it immediately
            if (currentIsDM) {
              let peerId: string | null = null;
              if (currentConversation.peerInboxId) {
                peerId = currentConversation.peerInboxId;
              } else if (currentMemberIds.length === 1) {
                peerId = currentMemberIds[0];
              } else if (currentMemberIds.length === 2) {
                peerId = currentMemberIds.find((id: string) => id !== currentUserInboxId) || currentMemberIds[0];
              }
              
              if (peerId) {
                ConversationService.getInstance().markAsDM(currentConversation.id, peerId);
                currentConversation.peerInboxId = peerId;
                currentConversation.version = 'DM';
                console.log('✅ Auto-detected DM when receiving message:', { id: currentConversation.id, peerId });
                
                // Reload conversations to update UI immediately
                await loadConversations();
              }
            }
          }
          
          const currentBlockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
          if (!currentIsDM && currentBlockedRooms.includes(currentConversation.id)) {
            // Stop processing messages if room is blocked
            break;
          }

          console.log('New message received!', currentIsDM ? '(DM)' : '(Room)');
          
        // Check if it's a special message type (call, room name change, etc.)
        let isSpecialMessage = false;
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
            
            // Skip notifications for payment messages and other system messages
            if (content.type === 'payment_sent' || content.type === 'payment_received' || content.type === 'attachment') {
              isSpecialMessage = true;
            }
          }
        } catch (e) {
          // Not a special message, continue
        }
        
        // Get conversation name for notification
        let conversationName = 'Unknown';
        
        try {
          if (currentIsDM) {
            const peerInboxId = currentConversation.peerInboxId || ConversationService.getInstance().getDMPeerInboxId(currentConversation.id);
            const storedAddresses = JSON.parse(localStorage.getItem('dm_wallet_addresses') || '{}');
            const walletAddress = peerInboxId ? storedAddresses[peerInboxId] : null;
            conversationName = walletAddress ? FormatUtils.getInstance().formatAddress(walletAddress) : 'DM';
          } else {
            const customName = ConversationService.getInstance().getConversationName(currentConversation.id);
            const roomNumber = ConversationService.getInstance().getRoomNumber(currentConversation.id);
            conversationName = customName || (roomNumber ? `Room ${roomNumber}` : 'Room');
          }
        } catch (nameError) {
          // If name detection fails, continue anyway
          console.log('Could not get conversation name:', nameError);
        }
        
        // Show notification for new message (skip special messages and own messages)
        const isOwnMessage = message.senderInboxId === xmtpClient?.inboxId;
        if (!isOwnMessage && !isSpecialMessage && message.content && typeof message.content === 'string') {
          const messageContent = message.content;
          await NotificationService.getInstance().showMessageNotification(
            conversationName,
            messageContent,
            currentConversation.id,
            currentIsDM
          );
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
