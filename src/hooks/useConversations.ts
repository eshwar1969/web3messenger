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
      setConversations(convs);

      console.log(`${convs.length} conversation(s) found`);
      
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `✅ ${convs.length} conversation(s) found`, type: 'success' }
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

    // Check if room is blocked
    const blockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
    if (conversation.version !== 'DM' && blockedRooms.includes(conversation.id)) {
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
      let dm: any = await XmtpService.getInstance().createDM(inboxId);

      if (!dm) {
        dm = await XmtpService.getInstance().createGroup([inboxId]);
        console.log('New DM conversation created');
      } else {
        console.log('DM conversation ready');
      }

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
        // Check if room is blocked
        const blockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
        if (currentConversation.version !== 'DM' && blockedRooms.includes(currentConversation.id)) {
          // Don't stream messages for blocked rooms
          return;
        }

        console.log('Listening for new messages...');
        const stream = await currentConversation.stream();

        for await (const message of stream) {
          // Check again if room is blocked (in case it was blocked while streaming)
          const currentBlockedRooms = JSON.parse(localStorage.getItem('xmtp_blocked_rooms') || '[]');
          if (currentConversation.version !== 'DM' && currentBlockedRooms.includes(currentConversation.id)) {
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
