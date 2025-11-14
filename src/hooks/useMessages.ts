import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FileService } from '../services/file.service';
import { WebRTCService } from '../services/webrtc.service';
import { FormatUtils } from '../utils/format';

export const useMessages = () => {
  const { currentConversation, messages, setMessages } = useAppStore();

  const sendMessage = useCallback(async (content: string) => {
    if (!currentConversation) {
      throw new Error('No conversation selected');
    }

    try {
      await currentConversation.send(content);
      console.log('Message sent successfully');
      
      // Dispatch log event
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: '✅ Message delivered!', type: 'success' }
      }));

      // Don't reload messages here - let the stream handle it to avoid duplicates
      // The stream will automatically pick up the new message and update the UI
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      console.error('Send error:', err);
      
      // Dispatch error log
      window.dispatchEvent(new CustomEvent('app-log', {
        detail: { message: `❌ Send error: ${errorMessage}`, type: 'error' }
      }));
      
      throw new Error(errorMessage);
    }
  }, [currentConversation]);

  const sendFile = useCallback(async (file: File) => {
    await FileService.getInstance().handleFileUpload(file);
  }, []);

  const displayMessage = useCallback((message: any) => {
    // Check for attachments first
    if (FileService.getInstance().displayAttachment(message)) {
      return;
    }

    // Handle call messages
    handleCallMessage(message);

    // Display regular message
    displayRegularMessage(message);
  }, []);

  const displayRegularMessage = useCallback((message: any) => {
    const messagesDiv = document.getElementById('messages');
    if (!messagesDiv) return;

    if (messagesDiv.querySelector('.empty-state')) {
      messagesDiv.innerHTML = '';
    }

    const date = new Date(Number(message.sentAtNs) / 1000000);
    const xmtpClient = useAppStore.getState().xmtpClient;
    const isSent = message.senderInboxId === xmtpClient?.inboxId;

    const messageEl = document.createElement('div');
    messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
    messageEl.innerHTML = `
      <div class="message-header">
        <span>${isSent ? '📤 You' : '📥 ' + message.senderInboxId.slice(0, 8)}</span>
        <span>${date.toLocaleTimeString()}</span>
      </div>
      <div class="message-content">${FormatUtils.getInstance().escapeHtml(message.content)}</div>
    `;

    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, []);

  const handleCallMessage = useCallback(async (message: any) => {
    // Ignore our own messages
    const xmtpClient = useAppStore.getState().xmtpClient;
    if (message.senderInboxId === xmtpClient?.inboxId) return;

    try {
      const callData = JSON.parse(message.content);

      if (callData.type === 'call_offer') {
        const accept = confirm(`Incoming ${callData.callType} call. Accept?`);
        if (accept) {
          await handleIncomingCall(callData);
        } else {
          await WebRTCService.getInstance().sendCallResponse('declined');
        }
      } else if (callData.type === 'call_answer') {
        await WebRTCService.getInstance().setRemoteDescription(callData.answer);
        useAppStore.getState().setCallState({ state: 'connected' });
      } else if (callData.type === 'call_response') {
        if (callData.status === 'busy' || callData.status === 'declined') {
          WebRTCService.getInstance().endCall();
          alert(`Call ${callData.status}`);
        }
      } else if (callData.type === 'ice_candidate') {
        await WebRTCService.getInstance().addIceCandidate(callData.candidate);
      } else if (callData.type === 'end_call') {
        WebRTCService.getInstance().endCall();
      }
    } catch (error) {
      // Not a call message, ignore
    }
  }, []);

  const handleIncomingCall = useCallback(async (callData: any) => {
    try {
      useAppStore.getState().setCallState({ state: 'ringing', type: callData.callType });

      const constraints = {
        audio: true,
        video: callData.callType === 'video'
      };

      await WebRTCService.getInstance().getUserMedia(constraints);
      await WebRTCService.getInstance().initializePeerConnection(false);
      await WebRTCService.getInstance().setRemoteDescription(callData.offer);

      const answer = await WebRTCService.getInstance().createAnswer();
      await WebRTCService.getInstance().sendCallAnswer(answer);

      useAppStore.getState().setCallState({ state: 'connected' });
      console.log('Call connected!');

    } catch (error) {
      console.error('Failed to handle incoming call:', error);
      WebRTCService.getInstance().endCall();
    }
  }, []);

  return {
    messages,
    sendMessage,
    sendFile,
    displayMessage
  };
};
