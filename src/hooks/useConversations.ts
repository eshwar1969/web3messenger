import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { XmtpService } from '../services/xmtp.service';

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

  const selectConversation = useCallback(async (index: number) => {
    const conversation = conversations[index];
    if (!conversation) return;

    setCurrentConversation(conversation);
    console.log('Conversation selected');

    // Load messages for the selected conversation
    await loadMessages(conversation);

  }, [conversations, setCurrentConversation]);

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
        console.log('Listening for new messages...');
        const stream = await currentConversation.stream();

        for await (const message of stream) {
          console.log('New message received!');
          
          // Check if it's a call message (don't add to regular messages)
          try {
            const content = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
            if (content && typeof content === 'object' && (content.type === 'call_offer' || content.type === 'call_answer' || content.type === 'call_response' || content.type === 'ice_candidate' || content.type === 'end_call')) {
              // Handle call message separately
              const { handleCallMessage } = await import('../hooks/useMessages');
              // Call message handling will be done by useMessages hook
              continue;
            }
          } catch (e) {
            // Not a call message, continue
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
