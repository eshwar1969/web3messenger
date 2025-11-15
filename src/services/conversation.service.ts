export class ConversationService {
  private static instance: ConversationService;
  private readonly STORAGE_KEY = 'xmtp_conversation_names';

  static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  private getConversationNames(): Record<string, string> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private saveConversationNames(names: Record<string, string>): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(names));
    } catch (error) {
      console.error('Failed to save conversation names:', error);
    }
  }

  getConversationName(conversationId: string): string | null {
    const names = this.getConversationNames();
    return names[conversationId] || null;
  }

  setConversationName(conversationId: string, name: string): void {
    const names = this.getConversationNames();
    names[conversationId] = name.trim();
    this.saveConversationNames(names);
  }

  removeConversationName(conversationId: string): void {
    const names = this.getConversationNames();
    delete names[conversationId];
    this.saveConversationNames(names);
  }

  getAllNames(): Record<string, string> {
    return this.getConversationNames();
  }

  // Room numbering
  private readonly ROOM_COUNTER_KEY = 'xmtp_room_counter';
  private readonly ROOM_NUMBERS_KEY = 'xmtp_room_numbers';

  getNextRoomNumber(): number {
    try {
      const stored = localStorage.getItem(this.ROOM_COUNTER_KEY);
      const current = stored ? parseInt(stored, 10) : 0;
      const next = current + 1;
      localStorage.setItem(this.ROOM_COUNTER_KEY, next.toString());
      return next;
    } catch {
      return 1;
    }
  }

  assignRoomNumber(conversationId: string): number {
    try {
      const stored = localStorage.getItem(this.ROOM_NUMBERS_KEY);
      const roomNumbers: Record<string, number> = stored ? JSON.parse(stored) : {};
      
      // If room already has a number, return it
      if (roomNumbers[conversationId]) {
        return roomNumbers[conversationId];
      }
      
      // Assign new number
      const number = this.getNextRoomNumber();
      roomNumbers[conversationId] = number;
      localStorage.setItem(this.ROOM_NUMBERS_KEY, JSON.stringify(roomNumbers));
      return number;
    } catch {
      return 1;
    }
  }

  getRoomNumber(conversationId: string): number | null {
    try {
      const stored = localStorage.getItem(this.ROOM_NUMBERS_KEY);
      const roomNumbers: Record<string, number> = stored ? JSON.parse(stored) : {};
      return roomNumbers[conversationId] || null;
    } catch {
      return null;
    }
  }

  // DM Tracking - separate from rooms
  private readonly DM_TRACKING_KEY = 'xmtp_dm_conversations';

  /**
   * Mark a conversation as a DM (private chat)
   */
  markAsDM(conversationId: string, peerInboxId: string): void {
    const dms = this.getDMs();
    dms[conversationId] = {
      peerInboxId,
      createdAt: Date.now()
    };
    localStorage.setItem(this.DM_TRACKING_KEY, JSON.stringify(dms));
  }

  /**
   * Check if a conversation is a DM
   */
  isDM(conversationId: string): boolean {
    const dms = this.getDMs();
    return conversationId in dms;
  }

  /**
   * Get peer inbox ID for a DM
   */
  getDMPeerInboxId(conversationId: string): string | null {
    const dms = this.getDMs();
    return dms[conversationId]?.peerInboxId || null;
  }

  /**
   * Get all DMs
   */
  getDMs(): Record<string, { peerInboxId: string; createdAt: number }> {
    try {
      const stored = localStorage.getItem(this.DM_TRACKING_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Remove DM tracking (if conversation is converted to group)
   */
  unmarkAsDM(conversationId: string): void {
    const dms = this.getDMs();
    delete dms[conversationId];
    localStorage.setItem(this.DM_TRACKING_KEY, JSON.stringify(dms));
  }
}

