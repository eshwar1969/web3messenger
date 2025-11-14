import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { WebRTCService } from '../services/webrtc.service';

export const useCallHandler = () => {
  const { currentConversation, messages, callState } = useAppStore();
  const processedMessages = useRef<Set<string>>(new Set());
  const lastMessageCount = useRef<number>(0);
  const currentConversationId = useRef<string | null>(null);

  useEffect(() => {
    if (!currentConversation || !messages.length) {
      lastMessageCount.current = 0;
      currentConversationId.current = null;
      return;
    }

    // Reset processed messages when conversation changes
    if (currentConversationId.current !== currentConversation.id) {
      processedMessages.current.clear();
      currentConversationId.current = currentConversation.id;
      lastMessageCount.current = messages.length;
      return; // Don't process old messages when switching conversations
    }

    // Only process NEW messages (messages that weren't there before)
    const newMessages = messages.slice(lastMessageCount.current);
    lastMessageCount.current = messages.length;

    if (newMessages.length === 0) return;

    const handleIncomingCall = async (message: any) => {
      const xmtpClient = useAppStore.getState().xmtpClient;
      
      // Ignore messages from self
      if (message.senderInboxId === xmtpClient?.inboxId) return;

      // Create unique ID for message to avoid processing twice
      const messageId = `${message.sentAtNs}-${message.senderInboxId}-${currentConversation.id}`;
      if (processedMessages.current.has(messageId)) return;
      processedMessages.current.add(messageId);

      try {
        const callData = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
        
        if (!callData || typeof callData !== 'object' || !callData.type) return;

        // Only process call offers that are recent (within last 5 minutes)
        // This prevents old call messages from triggering popups
        if (callData.type === 'call_offer') {
          const messageTimestamp = Number(message.sentAtNs) / 1000000; // Convert nanoseconds to milliseconds
          const now = Date.now();
          const messageAge = now - messageTimestamp;
          
          // Ignore call offers older than 5 minutes
          if (messageAge > 5 * 60 * 1000) {
            console.log('Ignoring old call offer:', messageAge / 1000, 'seconds old');
            return;
          }

          const currentCallState = useAppStore.getState().callState;
          if (currentCallState.state !== 'idle') {
            await WebRTCService.getInstance().sendCallResponse('busy');
            return;
          }

          const accept = confirm(`Incoming ${callData.callType} call. Accept?`);
          if (accept) {
            window.dispatchEvent(new CustomEvent('app-log', {
              detail: { message: `📞 Accepting ${callData.callType} call...`, type: 'info' }
            }));

            const constraints = {
              audio: true,
              video: callData.callType === 'video'
            };

            await WebRTCService.getInstance().getUserMedia(constraints);
            await WebRTCService.getInstance().initializePeerConnection(false);
            await WebRTCService.getInstance().setRemoteDescription(callData.offer);
            const answer = await WebRTCService.getInstance().createAnswer();
            await WebRTCService.getInstance().sendCallAnswer(answer);

            useAppStore.getState().setCallState({ state: 'connected', type: callData.callType });
            
            window.dispatchEvent(new CustomEvent('app-log', {
              detail: { message: '✅ Call connected!', type: 'success' }
            }));
          } else {
            await WebRTCService.getInstance().sendCallResponse('declined');
          }
        } else if (callData.type === 'call_answer') {
          const currentCallState = useAppStore.getState().callState;
          if (currentCallState.state === 'calling') {
            await WebRTCService.getInstance().setRemoteDescription(callData.answer);
            useAppStore.getState().setCallState({ state: 'connected' });
            
            window.dispatchEvent(new CustomEvent('app-log', {
              detail: { message: '✅ Call connected!', type: 'success' }
            }));
          }
        } else if (callData.type === 'call_response') {
          if (callData.status === 'busy') {
            alert('Recipient is busy');
            WebRTCService.getInstance().endCall();
          } else if (callData.status === 'declined') {
            alert('Call declined');
            WebRTCService.getInstance().endCall();
          }
        } else if (callData.type === 'ice_candidate') {
          // Only add ICE candidate if we have an active call
          const currentCallState = useAppStore.getState().callState;
          if (currentCallState.state !== 'idle') {
            await WebRTCService.getInstance().addIceCandidate(callData.candidate);
          }
        } else if (callData.type === 'end_call') {
          WebRTCService.getInstance().endCall();
        }
      } catch (error) {
        // Not a call message or error parsing
        console.error('Call handling error:', error);
      }
    };

    // Only process NEW messages for call messages
    newMessages.forEach((message: any) => {
      if (typeof message.content === 'string') {
        try {
          const parsed = JSON.parse(message.content);
          if (parsed && parsed.type && (parsed.type.startsWith('call_') || parsed.type === 'ice_candidate')) {
            handleIncomingCall(message);
          }
        } catch (e) {
          // Not JSON, ignore
        }
      }
    });
  }, [messages, currentConversation, callState]);
};

