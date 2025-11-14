import { create } from 'zustand';
import { Client } from '@xmtp/browser-sdk';
import { BrowserProvider } from 'ethers';

export interface UserProfile {
  username: string;
  theme: string;
  nftProfile: any;
  profilePicture: string;
  customThemes: any[];
  stickerPacks: any[];
}

export interface Friend {
  id: string;
  username: string;
  value: string;
  type: 'inbox' | 'address';
}

export interface PendingRequest {
  id: string;
  senderInboxId: string;
  senderUsername: string;
  recipientInboxId: string;
  status: 'pending' | 'accepted' | 'declined';
}

export interface MessageQueueItem {
  id: string;
  conversationId: string;
  content: string;
  timestamp: number;
}

export interface CallState {
  state: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
  type: 'voice' | 'video' | null;
  accepted: boolean;
}

export interface AppState {
  // XMTP & Wallet
  xmtpClient: Client | null;
  provider: BrowserProvider | null;
  signer: any;
  walletAddress: string | null;

  // Conversations & Messages
  conversations: any[];
  currentConversation: any;
  messages: any[];

  // User Profile
  userProfile: UserProfile;

  // Friends & Directory
  friendDirectory: Friend[];
  pendingRequests: PendingRequest[];

  // Queues & Offline
  messageQueue: MessageQueueItem[];
  isOnline: boolean;

  // Calls
  callState: CallState;
  localStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;

  // UI State
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setXmtpClient: (client: Client | null) => void;
  setProvider: (provider: BrowserProvider | null) => void;
  setSigner: (signer: any) => void;
  setWalletAddress: (address: string | null) => void;
  setConversations: (conversations: any[]) => void;
  setCurrentConversation: (conversation: any) => void;
  setMessages: (messages: any[]) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  setFriendDirectory: (friends: Friend[]) => void;
  setPendingRequests: (requests: PendingRequest[]) => void;
  setMessageQueue: (queue: MessageQueueItem[]) => void;
  setCallState: (state: Partial<CallState>) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setPeerConnection: (pc: RTCPeerConnection | null) => void;
  setIsConnected: (connected: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const initialUserProfile: UserProfile = {
  username: '',
  theme: 'light',
  nftProfile: null,
  profilePicture: '',
  customThemes: [],
  stickerPacks: []
};

const initialCallState: CallState = {
  state: 'idle',
  type: null,
  accepted: false
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  xmtpClient: null,
  provider: null,
  signer: null,
  walletAddress: null,
  conversations: [],
  currentConversation: null,
  messages: [],
  userProfile: initialUserProfile,
  friendDirectory: [],
  pendingRequests: [],
  messageQueue: [],
  isOnline: navigator.onLine,
  callState: initialCallState,
  localStream: null,
  peerConnection: null,
  isConnected: false,
  isLoading: false,
  error: null,

  // Actions
  setXmtpClient: (client) => set({ xmtpClient: client }),
  setProvider: (provider) => set({ provider }),
  setSigner: (signer) => set({ signer }),
  setWalletAddress: (address) => set({ walletAddress: address }),
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  setMessages: (messages) => set({ messages }),
  updateUserProfile: (profile) => set((state) => ({
    userProfile: { ...state.userProfile, ...profile }
  })),
  setFriendDirectory: (friends) => set({ friendDirectory: friends }),
  setPendingRequests: (requests) => set({ pendingRequests: requests }),
  setMessageQueue: (queue) => set({ messageQueue: queue }),
  setCallState: (callState) => set((state) => ({
    callState: { ...state.callState, ...callState }
  })),
  setLocalStream: (stream) => set({ localStream: stream }),
  setPeerConnection: (pc) => set({ peerConnection: pc }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
