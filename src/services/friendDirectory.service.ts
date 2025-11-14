import { useAppStore, Friend, PendingRequest } from '../store/useAppStore';

const STORAGE_KEYS = {
  friends: 'xmtpFriendDirectory',
  pendingRequests: 'xmtpPendingRequests'
};

export class FriendDirectoryService {
  private static instance: FriendDirectoryService;

  static getInstance(): FriendDirectoryService {
    if (!FriendDirectoryService.instance) {
      FriendDirectoryService.instance = new FriendDirectoryService();
    }
    return FriendDirectoryService.instance;
  }

  // Friend Directory Management
  loadFriendDirectory(): Friend[] {
    const friends: Friend[] = [];
    if (!window.localStorage) {
      useAppStore.getState().setFriendDirectory(friends);
      return friends;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.friends);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validFriends = parsed.filter((item: any) =>
            item &&
            typeof item.id === 'string' &&
            typeof item.username === 'string' &&
            typeof item.value === 'string' &&
            (item.type === 'inbox' || item.type === 'address')
          );
          useAppStore.getState().setFriendDirectory(validFriends);
          return validFriends;
        }
      }
    } catch (error) {
      console.warn('Unable to load friend directory', error);
    }

    useAppStore.getState().setFriendDirectory(friends);
    return friends;
  }

  saveFriendDirectory(): void {
    if (!window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEYS.friends, JSON.stringify(useAppStore.getState().friendDirectory));
    } catch (error) {
      console.warn('Unable to persist friend directory', error);
    }
  }

  addFriend(username: string, value: string, type: 'inbox' | 'address'): boolean {
    const normalizedUsername = this.normalizeDisplayName(username);
    if (normalizedUsername.length < 3 || normalizedUsername.length > 32) {
      alert('Usernames must be between 3 and 32 characters.');
      return false;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(normalizedUsername)) {
      alert('Usernames can only include letters, numbers, dots, underscores, or hyphens.');
      return false;
    }

    if (!value) {
      alert('Please provide an inbox ID or wallet address.');
      return false;
    }

    if (type === 'address' && !/^0x[a-fA-F0-9]{40}$/i.test(value)) {
      alert('Enter a valid Ethereum address (0x...).');
      return false;
    }

    if (type === 'inbox' && value.length < 6) {
      alert('Inbox IDs should be at least 6 characters.');
      return false;
    }

    const friends = useAppStore.getState().friendDirectory;
    const existing = friends.find(friend => friend.username.toLowerCase() === normalizedUsername.toLowerCase());

    if (existing) {
      existing.value = value;
      existing.type = type;
    } else {
      const newFriend: Friend = {
        id: `${normalizedUsername}-${Date.now()}`,
        username: normalizedUsername,
        value,
        type
      };
      friends.push(newFriend);
    }

    useAppStore.getState().setFriendDirectory([...friends]);
    this.saveFriendDirectory();
    return true;
  }

  removeFriend(friendId: string): void {
    const friends = useAppStore.getState().friendDirectory;
    const updatedFriends = friends.filter(friend => friend.id !== friendId);
    useAppStore.getState().setFriendDirectory(updatedFriends);
    this.saveFriendDirectory();
  }

  // Pending Requests Management
  loadPendingRequests(): PendingRequest[] {
    const requests: PendingRequest[] = [];
    if (!window.localStorage) {
      useAppStore.getState().setPendingRequests(requests);
      return requests;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.pendingRequests);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validRequests = parsed.filter((item: any) =>
            item &&
            typeof item.id === 'string' &&
            typeof item.senderInboxId === 'string' &&
            typeof item.senderUsername === 'string' &&
            typeof item.recipientInboxId === 'string' &&
            (item.status === 'pending' || item.status === 'accepted' || item.status === 'declined')
          );
          useAppStore.getState().setPendingRequests(validRequests);
          return validRequests;
        }
      }
    } catch (error) {
      console.warn('Unable to load pending requests', error);
    }

    useAppStore.getState().setPendingRequests(requests);
    return requests;
  }

  savePendingRequests(): void {
    if (!window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEYS.pendingRequests, JSON.stringify(useAppStore.getState().pendingRequests));
    } catch (error) {
      console.warn('Unable to persist pending requests', error);
    }
  }

  private normalizeDisplayName(rawName: string): string {
    if (!rawName) return '';
    const trimmed = rawName.trim().replace(/^@+/, '');
    return trimmed;
  }
}
