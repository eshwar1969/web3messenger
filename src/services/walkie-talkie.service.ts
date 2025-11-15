import { Client } from '@xmtp/browser-sdk';

/**
 * Real-time Walkie-Talkie Service
 * Uses WebRTC to broadcast audio in real-time to all channel members
 */
export class WalkieTalkieService {
  private static instance: WalkieTalkieService;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private isBroadcasting: boolean = false;
  private currentBroadcaster: string | null = null; // Inbox ID of person currently talking
  private xmtpClient: Client | null = null;
  private conversation: any = null;
  private channelMembers: Set<string> = new Set();
  private iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  private constructor() {}

  public static getInstance(): WalkieTalkieService {
    if (!WalkieTalkieService.instance) {
      WalkieTalkieService.instance = new WalkieTalkieService();
    }
    return WalkieTalkieService.instance;
  }

  /**
   * Initialize the walkie-talkie service
   */
  async initialize(conversation: any, xmtpClient: Client) {
    this.conversation = conversation;
    this.xmtpClient = xmtpClient;
    
    // Get channel members
    await conversation.sync();
    const members = conversation.memberInboxIds || [];
    const currentUserInboxId = xmtpClient.inboxId;
    
    // Add all members except current user
    this.channelMembers.clear();
    members.forEach((inboxId: string) => {
      if (inboxId !== currentUserInboxId) {
        this.channelMembers.add(inboxId);
      }
    });

    // Set up audio context for mixing (only if not already set up)
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.destinationNode = this.audioContext.createMediaStreamDestination();
    }

    console.log('Walkie-talkie initialized with', this.channelMembers.size, 'members');
  }

  /**
   * Refresh member list (call this when members are added)
   */
  async refreshMembers() {
    if (!this.conversation || !this.xmtpClient) return;
    
    await this.conversation.sync();
    const members = this.conversation.memberInboxIds || [];
    const currentUserInboxId = this.xmtpClient.inboxId;
    
    // Update member set
    this.channelMembers.clear();
    members.forEach((inboxId: string) => {
      if (inboxId !== currentUserInboxId) {
        this.channelMembers.add(inboxId);
      }
    });
    
    console.log('Walkie-talkie members refreshed:', this.channelMembers.size, 'members');
  }

  /**
   * Start broadcasting (push to talk)
   */
  async startBroadcasting(): Promise<void> {
    if (this.isBroadcasting) {
      console.log('Already broadcasting');
      return;
    }

    if (!this.conversation || !this.xmtpClient) {
      throw new Error('Walkie-talkie not initialized');
    }

    try {
      // Get microphone access
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });

      // Signal to all members that we're starting to broadcast
      const broadcastStart = {
        type: 'walkie_talkie_start',
        broadcasterInboxId: this.xmtpClient.inboxId,
        timestamp: Date.now()
      };
      await this.conversation.send(JSON.stringify(broadcastStart));

      // Create peer connections to all members
      await this.createPeerConnections();

      // Add local audio track to all peer connections
      this.localStream.getTracks().forEach(track => {
        this.peerConnections.forEach((pc, inboxId) => {
          try {
            pc.addTrack(track, this.localStream!);
          } catch (error) {
            console.warn(`Could not add track to peer ${inboxId}:`, error);
          }
        });
      });

      this.isBroadcasting = true;
      this.currentBroadcaster = this.xmtpClient.inboxId;

      // Dispatch event for UI
      window.dispatchEvent(new CustomEvent('walkie-talkie-broadcast-start', {
        detail: { broadcasterInboxId: this.xmtpClient.inboxId }
      }));

      console.log('Started broadcasting to', this.peerConnections.size, 'peers');
    } catch (error) {
      console.error('Error starting broadcast:', error);
      throw new Error('Failed to start broadcasting: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Stop broadcasting (release button)
   */
  async stopBroadcasting(): Promise<void> {
    if (!this.isBroadcasting) {
      return;
    }

    try {
      // Signal to all members that we're stopping
      if (this.conversation && this.xmtpClient) {
        const broadcastStop = {
          type: 'walkie_talkie_stop',
          broadcasterInboxId: this.xmtpClient.inboxId,
          timestamp: Date.now()
        };
        await this.conversation.send(JSON.stringify(broadcastStop));
      }

      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      // Close all peer connections
      this.peerConnections.forEach((pc, inboxId) => {
        pc.close();
      });
      this.peerConnections.clear();

      this.isBroadcasting = false;
      this.currentBroadcaster = null;

      // Dispatch event for UI
      window.dispatchEvent(new CustomEvent('walkie-talkie-broadcast-stop', {
        detail: { broadcasterInboxId: this.xmtpClient?.inboxId }
      }));

      console.log('Stopped broadcasting');
    } catch (error) {
      console.error('Error stopping broadcast:', error);
    }
  }

  /**
   * Create peer connections to all channel members
   */
  private async createPeerConnections(): Promise<void> {
    if (!this.xmtpClient) return;

    const currentUserInboxId = this.xmtpClient.inboxId;

    for (const memberInboxId of this.channelMembers) {
      if (memberInboxId === currentUserInboxId) continue;

      try {
        const pc = new RTCPeerConnection({ iceServers: this.iceServers });

        // Handle remote audio stream
        pc.ontrack = (event) => {
          const remoteStream = event.streams[0];
          if (remoteStream) {
            // Play the remote audio
            this.playRemoteAudio(remoteStream, memberInboxId);
          }
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
          if (event.candidate && this.conversation) {
            const iceData = {
              type: 'walkie_talkie_ice',
              fromInboxId: currentUserInboxId,
              toInboxId: memberInboxId,
              candidate: event.candidate,
              timestamp: Date.now()
            };
            this.conversation.send(JSON.stringify(iceData)).catch(console.error);
          }
        };

        // Handle connection state
        pc.onconnectionstatechange = () => {
          console.log(`Connection to ${memberInboxId}: ${pc.connectionState}`);
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            // Try to reconnect
            setTimeout(() => {
              if (this.isBroadcasting && !this.peerConnections.has(memberInboxId)) {
                this.createPeerConnectionForMember(memberInboxId);
              }
            }, 2000);
          }
        };

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const offerData = {
          type: 'walkie_talkie_offer',
          fromInboxId: currentUserInboxId,
          toInboxId: memberInboxId,
          offer: offer,
          timestamp: Date.now()
        };

        if (this.conversation) {
          await this.conversation.send(JSON.stringify(offerData));
        }

        this.peerConnections.set(memberInboxId, pc);
      } catch (error) {
        console.error(`Error creating peer connection to ${memberInboxId}:`, error);
      }
    }
  }

  /**
   * Create a peer connection for a specific member
   */
  private async createPeerConnectionForMember(memberInboxId: string): Promise<void> {
    if (!this.xmtpClient || this.peerConnections.has(memberInboxId)) return;

    const currentUserInboxId = this.xmtpClient.inboxId;
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        this.playRemoteAudio(remoteStream, memberInboxId);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && this.conversation) {
        const iceData = {
          type: 'walkie_talkie_ice',
          fromInboxId: currentUserInboxId,
          toInboxId: memberInboxId,
          candidate: event.candidate,
          timestamp: Date.now()
        };
        this.conversation.send(JSON.stringify(iceData)).catch(console.error);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const offerData = {
      type: 'walkie_talkie_offer',
      fromInboxId: currentUserInboxId,
      toInboxId: memberInboxId,
      offer: offer,
      timestamp: Date.now()
    };

    if (this.conversation) {
      await this.conversation.send(JSON.stringify(offerData));
    }

    this.peerConnections.set(memberInboxId, pc);
  }

  /**
   * Handle incoming walkie-talkie messages
   */
  async handleMessage(message: any): Promise<void> {
    if (!this.xmtpClient || !this.conversation) return;

    const currentUserInboxId = this.xmtpClient.inboxId;
    const senderInboxId = message.senderInboxId;

    // Ignore own messages
    if (senderInboxId === currentUserInboxId) return;

    try {
      const data = typeof message.content === 'string' 
        ? JSON.parse(message.content) 
        : message.content;

      if (!data || typeof data !== 'object' || !data.type) return;

      switch (data.type) {
        case 'walkie_talkie_start':
          // Someone started broadcasting
          this.currentBroadcaster = data.broadcasterInboxId;
          
          // If it's not us, we need to be ready to receive their audio
          // The broadcaster will send us an offer, so we just need to be ready
          if (data.broadcasterInboxId !== currentUserInboxId) {
            // Ensure we have a peer connection ready for this broadcaster
            if (!this.peerConnections.has(senderInboxId)) {
              // Create a passive peer connection to receive audio
              const pc = new RTCPeerConnection({ iceServers: this.iceServers });
              
              pc.ontrack = (event) => {
                const remoteStream = event.streams[0];
                if (remoteStream) {
                  this.playRemoteAudio(remoteStream, senderInboxId);
                }
              };

              pc.onicecandidate = (event) => {
                if (event.candidate && this.conversation) {
                  const iceData = {
                    type: 'walkie_talkie_ice',
                    fromInboxId: currentUserInboxId,
                    toInboxId: senderInboxId,
                    candidate: event.candidate,
                    timestamp: Date.now()
                  };
                  this.conversation.send(JSON.stringify(iceData)).catch(console.error);
                }
              };

              this.peerConnections.set(senderInboxId, pc);
            }
          }
          
          window.dispatchEvent(new CustomEvent('walkie-talkie-broadcast-start', {
            detail: { broadcasterInboxId: data.broadcasterInboxId }
          }));
          break;

        case 'walkie_talkie_stop':
          // Someone stopped broadcasting
          if (this.currentBroadcaster === data.broadcasterInboxId) {
            this.currentBroadcaster = null;
          }
          window.dispatchEvent(new CustomEvent('walkie-talkie-broadcast-stop', {
            detail: { broadcasterInboxId: data.broadcasterInboxId }
          }));
          break;

        case 'walkie_talkie_offer':
          // Incoming WebRTC offer
          if (data.toInboxId === currentUserInboxId) {
            await this.handleOffer(data.offer, senderInboxId);
          }
          break;

        case 'walkie_talkie_answer':
          // Incoming WebRTC answer
          if (data.toInboxId === currentUserInboxId) {
            await this.handleAnswer(data.answer, senderInboxId);
          }
          break;

        case 'walkie_talkie_ice':
          // Incoming ICE candidate
          if (data.toInboxId === currentUserInboxId) {
            await this.handleIceCandidate(data.candidate, senderInboxId);
          }
          break;
      }
    } catch (error) {
      console.error('Error handling walkie-talkie message:', error);
    }
  }

  /**
   * Handle incoming WebRTC offer
   */
  private async handleOffer(offer: RTCSessionDescriptionInit, senderInboxId: string): Promise<void> {
    if (!this.xmtpClient || !this.conversation) return;

    const currentUserInboxId = this.xmtpClient.inboxId;

    // Create peer connection if it doesn't exist
    if (!this.peerConnections.has(senderInboxId)) {
      const pc = new RTCPeerConnection({ iceServers: this.iceServers });

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0];
        if (remoteStream) {
          this.playRemoteAudio(remoteStream, senderInboxId);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && this.conversation) {
          const iceData = {
            type: 'walkie_talkie_ice',
            fromInboxId: currentUserInboxId,
            toInboxId: senderInboxId,
            candidate: event.candidate,
            timestamp: Date.now()
          };
          this.conversation.send(JSON.stringify(iceData)).catch(console.error);
        }
      };

      this.peerConnections.set(senderInboxId, pc);
    }

    const pc = this.peerConnections.get(senderInboxId);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const answerData = {
      type: 'walkie_talkie_answer',
      fromInboxId: currentUserInboxId,
      toInboxId: senderInboxId,
      answer: answer,
      timestamp: Date.now()
    };

    await this.conversation.send(JSON.stringify(answerData));
  }

  /**
   * Handle incoming WebRTC answer
   */
  private async handleAnswer(answer: RTCSessionDescriptionInit, senderInboxId: string): Promise<void> {
    const pc = this.peerConnections.get(senderInboxId);
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  /**
   * Handle incoming ICE candidate
   */
  private async handleIceCandidate(candidate: RTCIceCandidateInit, senderInboxId: string): Promise<void> {
    const pc = this.peerConnections.get(senderInboxId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  }

  /**
   * Play remote audio stream
   */
  private playRemoteAudio(stream: MediaStream, senderInboxId: string): void {
    // Create audio element for this sender
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = 1.0;

    // Store reference to prevent garbage collection
    (audio as any)._senderInboxId = senderInboxId;

    audio.onloadedmetadata = () => {
      audio.play().catch(console.error);
    };

    // Dispatch event for UI
    window.dispatchEvent(new CustomEvent('walkie-talkie-audio-received', {
      detail: { senderInboxId }
    }));
  }

  /**
   * Get current broadcaster
   */
  getCurrentBroadcaster(): string | null {
    return this.currentBroadcaster;
  }

  /**
   * Check if currently broadcasting
   */
  isCurrentlyBroadcasting(): boolean {
    return this.isBroadcasting;
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.stopBroadcasting();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.destinationNode = null;
    this.peerConnections.clear();
    this.channelMembers.clear();
    this.currentBroadcaster = null;
  }
}

