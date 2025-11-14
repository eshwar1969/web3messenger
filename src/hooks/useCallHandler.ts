import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { WebRTCService } from '../services/webrtc.service';

export const useCallHandler = () => {
  const { currentConversation, messages, callState } = useAppStore();
  const processedMessages = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentConversation || !messages.length) return;

    const handleIncomingCall = async (message: any) => {
      const xmtpClient = useAppStore.getState().xmtpClient;
      if (message.senderInboxId === xmtpClient?.inboxId) return;

      // Create unique ID for message to avoid processing twice
      const messageId = `${message.sentAtNs}-${message.senderInboxId}`;
      if (processedMessages.current.has(messageId)) return;
      processedMessages.current.add(messageId);

      try {
        const callData = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
        
        if (!callData || typeof callData !== 'object' || !callData.type) return;

        if (callData.type === 'call_offer') {
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
          await WebRTCService.getInstance().addIceCandidate(callData.candidate);
        } else if (callData.type === 'end_call') {
          WebRTCService.getInstance().endCall();
        }
      } catch (error) {
        // Not a call message or error parsing
        console.error('Call handling error:', error);
      }
    };

    // Check latest messages for call messages
    messages.forEach((message: any) => {
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

