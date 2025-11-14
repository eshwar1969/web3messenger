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
}

