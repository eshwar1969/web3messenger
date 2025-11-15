import { Client } from '@xmtp/browser-sdk';

/**
 * Push-to-Talk Service for Walkie-Talkie functionality
 * Streams one-way audio to group using WebRTC
 */
export class PushToTalkService {
  private static instance: PushToTalkService;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;
  private audioStream: MediaStream | null = null;
  private xmtpClient: Client | null = null;
  private conversation: any = null;

  private constructor() {}

  /**
   * Set current conversation for sending messages
   */
  setConversation(conversation: any) {
    this.conversation = conversation;
  }

  public static getInstance(): PushToTalkService {
    if (!PushToTalkService.instance) {
      PushToTalkService.instance = new PushToTalkService();
    }
    return PushToTalkService.instance;
  }

  /**
   * Set XMTP client for sending audio messages
   */
  setXmtpClient(client: Client) {
    this.xmtpClient = client;
  }

  /**
   * Start recording audio (push button)
   */
  async startRecording(): Promise<void> {
    if (this.isRecording) {
      return;
    }

    try {
      // Request microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        console.log('MediaRecorder stopped, audio chunks:', this.audioChunks.length);
        // Wait a bit to ensure all data is collected
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (this.conversation && this.audioChunks.length > 0) {
          try {
            await this.sendAudioMessage(this.conversation);
          } catch (error) {
            console.error('Error in onstop handler:', error);
          }
        } else {
          console.warn('Cannot send: no conversation or no audio chunks', {
            hasConversation: !!this.conversation,
            chunksCount: this.audioChunks.length
          });
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms for streaming
      this.isRecording = true;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to access microphone');
    }
  }

  /**
   * Stop recording (release button)
   */
  async stopRecording(): Promise<void> {
    if (!this.isRecording || !this.mediaRecorder) {
      console.log('Not recording or no media recorder');
      return;
    }

    console.log('Stopping recording...');
    this.isRecording = false;

    try {
      // Stop the media recorder
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      // Wait for the onstop event to fire and process
      await new Promise(resolve => setTimeout(resolve, 200));

      // Stop all tracks
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped audio track');
        });
        this.audioStream = null;
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }

  /**
   * Send recorded audio as message
   * Note: conversation should be passed when calling stopRecording
   */
  async sendAudioMessage(conversation: any): Promise<void> {
    if (!this.xmtpClient || this.audioChunks.length === 0 || !conversation) {
      console.warn('Cannot send audio message:', {
        hasClient: !!this.xmtpClient,
        chunksCount: this.audioChunks.length,
        hasConversation: !!conversation
      });
      return;
    }

    try {
      // Combine audio chunks
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      
      if (audioBlob.size === 0) {
        console.warn('Audio blob is empty, not sending');
        this.audioChunks = [];
        return;
      }
      
      // Convert to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const base64Audio = reader.result as string;
            const base64Data = base64Audio.split(',')[1]; // Remove data URL prefix
            resolve(base64Data);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Send as attachment (matching the format used in ChatPage for voice messages)
      const attachment = {
        filename: `ptt_${Date.now()}.webm`,
        mimeType: 'audio/webm',
        data: base64Data,
        type: 'voice_message' // Use same type as voice messages for consistency
      };

      const content = JSON.stringify({
        type: 'attachment',
        attachment: attachment
      });

      console.log('Sending push-to-talk message...', { blobSize: audioBlob.size, contentLength: content.length });
      await conversation.send(content);
      console.log('Push-to-talk message sent successfully');
      
      // Dispatch event to notify UI
      window.dispatchEvent(new CustomEvent('ptt-message-sent'));
      
      this.audioChunks = [];
    } catch (error) {
      console.error('Error sending audio message:', error);
      throw error; // Re-throw so the UI can handle it
    }
  }

  /**
   * Check if currently recording
   */
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.isRecording) {
      this.stopRecording();
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
  }
}

